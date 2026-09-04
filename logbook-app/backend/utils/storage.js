/**
 * Small filesystem storage helpers.
 *
 * Kept behind simple functions so this file is the ONLY place that needs to
 * change if templates/records move to S3 / Azure Blob / a real DB later.
 * Everything else in the app calls these functions, never `fs` directly.
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function generateId() {
  return uuidv4();
}

/**
 * Only allow UUID-shaped ids to ever be used to build filesystem paths.
 * This is the main defense against path traversal via route params like
 * `/api/records/:id` — a crafted id such as `../../etc/passwd` is rejected
 * before it ever reaches path.join().
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

function readJSON(filePath, fallback = null) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

/**
 * Atomic-ish write: write to a temp file then rename, so a crash mid-write
 * never leaves a half-written / corrupt JSON file behind.
 */
function writeJSON(filePath, data) {
  ensureDirSync(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

module.exports = { ensureDirSync, generateId, isValidId, readJSON, writeJSON };
