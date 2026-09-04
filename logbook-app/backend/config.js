require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  // Root of all persisted data. Swap this layer out for S3/Azure Blob later
  // by re-implementing utils/storage.js behind the same function signatures.
  DATA_DIR: path.join(__dirname, 'data'),
  TEMPLATES_DIR: path.join(__dirname, 'data', 'templates'),
  RECORDS_DIR: path.join(__dirname, 'data', 'records'),
  MAX_UPLOAD_BYTES: 20 * 1024 * 1024, // 20MB
};
