const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');

const { requireAuth, requireAdmin } = require('../middleware/auth');
const { TEMPLATES_DIR, MAX_UPLOAD_BYTES } = require('../config');
const { ensureDirSync, generateId, isValidId, readJSON, writeJSON } = require('../utils/storage');

const router = express.Router();
ensureDirSync(TEMPLATES_DIR);

const META_PATH = path.join(TEMPLATES_DIR, '_meta.json');

function loadMeta() {
  return readJSON(META_PATH, []);
}
function saveMeta(list) {
  writeJSON(META_PATH, list);
}

// --- Multer setup: only accept real PDFs, cap size, never trust client filenames ---
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMPLATES_DIR),
    filename: (req, file, cb) => {
      // Server generates the filename. The client's original filename is
      // never used to build a path (prevents path traversal / overwrite
      // attacks); it is only kept as a display label in metadata.
      req._generatedId = req._generatedId || generateId();
      cb(null, `${req._generatedId}.pdf`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const extOk = path.extname(file.originalname).toLowerCase() === '.pdf';
    const mimeOk = file.mimetype === 'application/pdf';
    if (!extOk || !mimeOk) {
      return cb(new Error('Only .pdf files are accepted'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/templates
 * Admin (college) uploads a blank PDF template (logbook / practical record).
 */
router.post('/', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });
  }

  const filePath = path.join(TEMPLATES_DIR, req.file.filename);

  // Extra validation beyond mimetype/extension: actually try to parse the
  // PDF. Rejects renamed non-PDF files or corrupt uploads.
  let pageCount = 0;
  try {
    const bytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });
    pageCount = pdfDoc.getPageCount();
  } catch (err) {
    fs.unlinkSync(filePath);
    return res.status(400).json({ error: 'File is not a valid PDF' });
  }

  const meta = loadMeta();
  const record = {
    id: req._generatedId,
    title: (req.body.title || req.file.originalname || 'Untitled template').slice(0, 200),
    pageCount,
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.username,
  };
  meta.push(record);
  saveMeta(meta);

  res.status(201).json(record);
});

/** GET /api/templates — list all templates (any authenticated user). */
router.get('/', requireAuth, (req, res) => {
  res.json(loadMeta());
});

/** GET /api/templates/:id/file — stream the raw PDF bytes. */
router.get('/:id/file', requireAuth, (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid template id' });

  const meta = loadMeta().find((t) => t.id === id);
  if (!meta) return res.status(404).json({ error: 'Template not found' });

  const filePath = path.join(TEMPLATES_DIR, `${id}.pdf`);
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(filePath);
});

/** GET /api/templates/:id/fields — get the field-position schema. */
router.get('/:id/fields', requireAuth, (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid template id' });

  const fieldsPath = path.join(TEMPLATES_DIR, `${id}.fields.json`);
  const data = readJSON(fieldsPath, { templateId: id, fields: [] });
  res.json(data);
});

/**
 * POST /api/templates/:id/fields — save the field-position schema
 * (text/checkbox/radio/select boxes placed on top of the PDF pages by the
 * college admin in the "template designer" screen).
 */
router.post('/:id/fields', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid template id' });

  const meta = loadMeta().find((t) => t.id === id);
  if (!meta) return res.status(404).json({ error: 'Template not found' });

  const fields = Array.isArray(req.body.fields) ? req.body.fields : [];

  // Minimal shape validation — reject anything that isn't a plausible field.
  const ALLOWED_TYPES = new Set(['text', 'checkbox', 'radio', 'select']);
  for (const f of fields) {
    if (!f.id || !ALLOWED_TYPES.has(f.type) || typeof f.page !== 'number') {
      return res.status(400).json({ error: 'Invalid field definition', field: f });
    }
  }

  const fieldsPath = path.join(TEMPLATES_DIR, `${id}.fields.json`);
  writeJSON(fieldsPath, { templateId: id, fields, updatedAt: new Date().toISOString() });

  res.json({ templateId: id, fields });
});

module.exports = router;
