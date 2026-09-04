const express = require('express');
const fs = require('fs');
const path = require('path');

const { requireAuth } = require('../middleware/auth');
const { TEMPLATES_DIR, RECORDS_DIR } = require('../config');
const { ensureDirSync, generateId, isValidId, readJSON, writeJSON } = require('../utils/storage');
const { exportFilledPdf } = require('../utils/pdfExport');

const router = express.Router();

const MAX_VERSIONS_KEPT = 25;

/**
 * Records are stored at data/records/<userId>/<recordId>.json.
 * Scoping by userId in the FILE PATH (not just a field inside the JSON) is
 * a deliberate second layer of access control: even a bug that skipped the
 * ownership check on the JSON field would still not let user A read a file
 * that lives under user B's folder, because we always build the path from
 * `req.userId` (taken from the verified JWT), never from client input.
 */
function userDir(userId) {
  return path.join(RECORDS_DIR, userId);
}
function recordPath(userId, recordId) {
  return path.join(userDir(userId), `${recordId}.json`);
}

function loadTemplateMeta(templateId) {
  const meta = readJSON(path.join(TEMPLATES_DIR, '_meta.json'), []);
  return meta.find((t) => t.id === templateId);
}
function loadTemplateFields(templateId) {
  const data = readJSON(path.join(TEMPLATES_DIR, `${templateId}.fields.json`), { fields: [] });
  return data.fields || [];
}

/** POST /api/records — start a new (empty) record from a template. */
router.post('/', requireAuth, (req, res) => {
  const { templateId } = req.body || {};
  if (!isValidId(templateId)) return res.status(400).json({ error: 'Invalid templateId' });

  const template = loadTemplateMeta(templateId);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const id = generateId();
  const now = new Date().toISOString();
  const record = {
    id,
    userId: req.userId,
    templateId,
    templateTitle: template.title,
    createdAt: now,
    updatedAt: now,
    currentVersion: 1,
    versions: [
      { version: 1, savedAt: now, values: {}, drawings: {} },
    ],
  };

  ensureDirSync(userDir(req.userId));
  writeJSON(recordPath(req.userId, id), record);

  res.status(201).json(record);
});

/** GET /api/records — list the CURRENT user's records (summary only). */
router.get('/', requireAuth, (req, res) => {
  const dir = userDir(req.userId);
  ensureDirSync(dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  const summaries = files.map((f) => {
    const r = readJSON(path.join(dir, f));
    return {
      id: r.id,
      templateId: r.templateId,
      templateTitle: r.templateTitle,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      currentVersion: r.currentVersion,
      versionCount: r.versions.length,
    };
  });

  summaries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(summaries);
});

/** Shared loader with ownership check. Returns null (and writes 404/400) on failure. */
function loadOwnedRecordOr404(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ error: 'Invalid record id' });
    return null;
  }
  const record = readJSON(recordPath(req.userId, id));
  if (!record) {
    // Same 404 whether it doesn't exist OR belongs to someone else —
    // never leak which case it is.
    res.status(404).json({ error: 'Record not found' });
    return null;
  }
  return record;
}

/** GET /api/records/:id — full record incl. latest values (for reopening a draft). */
router.get('/:id', requireAuth, (req, res) => {
  const record = loadOwnedRecordOr404(req, res);
  if (!record) return;
  res.json(record);
});

/** GET /api/records/:id/versions — version history metadata (no content). */
router.get('/:id/versions', requireAuth, (req, res) => {
  const record = loadOwnedRecordOr404(req, res);
  if (!record) return;
  res.json(record.versions.map((v) => ({ version: v.version, savedAt: v.savedAt })));
});

/** GET /api/records/:id/versions/:v — a specific historical version's content. */
router.get('/:id/versions/:v', requireAuth, (req, res) => {
  const record = loadOwnedRecordOr404(req, res);
  if (!record) return;
  const versionNum = parseInt(req.params.v, 10);
  const version = record.versions.find((v) => v.version === versionNum);
  if (!version) return res.status(404).json({ error: 'Version not found' });
  res.json(version);
});

/**
 * PUT /api/records/:id — save the student's current edits as a NEW version.
 * We never overwrite a previous version in place, so a student (or admin,
 * in a future audit feature) can always see what was submitted and when.
 */
router.put('/:id', requireAuth, (req, res) => {
  const record = loadOwnedRecordOr404(req, res);
  if (!record) return;

  const { values, drawings } = req.body || {};
  const nextVersion = record.versions.length
    ? record.versions[record.versions.length - 1].version + 1
    : 1;

  record.versions.push({
    version: nextVersion,
    savedAt: new Date().toISOString(),
    values: values || {},
    drawings: drawings || {},
  });

  // Cap history so a heavily-edited logbook doesn't grow the file forever.
  if (record.versions.length > MAX_VERSIONS_KEPT) {
    record.versions = record.versions.slice(record.versions.length - MAX_VERSIONS_KEPT);
  }

  record.currentVersion = nextVersion;
  record.updatedAt = new Date().toISOString();

  writeJSON(recordPath(req.userId, record.id), record);
  res.json(record);
});

/**
 * POST /api/records/:id/export — flatten a version (default: latest) into a
 * real, downloadable PDF and stream it back. Also persists a copy under the
 * user's record folder so "download it later" works without re-exporting.
 */
router.post('/:id/export', requireAuth, async (req, res) => {
  const record = loadOwnedRecordOr404(req, res);
  if (!record) return;

  const requestedVersion = req.body && req.body.version;
  const version = requestedVersion
    ? record.versions.find((v) => v.version === requestedVersion)
    : record.versions[record.versions.length - 1];

  if (!version) return res.status(404).json({ error: 'Version not found' });

  const template = loadTemplateMeta(record.templateId);
  if (!template) return res.status(404).json({ error: 'Template for this record no longer exists' });

  const templatePath = path.join(TEMPLATES_DIR, `${record.templateId}.pdf`);
  const templateBytes = fs.readFileSync(templatePath);
  const fields = loadTemplateFields(record.templateId);

  const pdfBytes = await exportFilledPdf({
    templateBytes,
    fields,
    values: version.values,
    drawings: version.drawings,
  });

  // Persist the export next to the record so it can be re-downloaded later
  // without needing to regenerate it.
  const exportDir = path.join(userDir(req.userId), record.id);
  ensureDirSync(exportDir);
  const exportPath = path.join(exportDir, `export-v${version.version}.pdf`);
  fs.writeFileSync(exportPath, pdfBytes);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${record.templateTitle.replace(/[^a-z0-9-_]+/gi, '_')}-v${version.version}.pdf"`
  );
  res.send(Buffer.from(pdfBytes));
});

module.exports = router;
