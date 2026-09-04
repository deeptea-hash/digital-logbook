const express = require('express');
const cors = require('cors');

const { PORT, TEMPLATES_DIR, RECORDS_DIR } = require('./config');
const { ensureDirSync } = require('./utils/storage');

ensureDirSync(TEMPLATES_DIR);
ensureDirSync(RECORDS_DIR);

const authRoutes = require('./routes/auth');
const templateRoutes = require('./routes/templates');
const recordRoutes = require('./routes/records');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' })); // form values + drawing strokes only; PDFs go via multer

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/records', recordRoutes);

// Central error handler — also catches multer errors (e.g. file too large,
// wrong file type) thrown from the templates route.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 400;
  res.status(status).json({ error: err.message || 'Unexpected error' });
});

app.listen(PORT, () => {
  console.log(`Logbook backend listening on http://localhost:${PORT}`);
});
