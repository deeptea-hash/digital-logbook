import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  async function refresh() {
    const { data } = await client.get('/templates');
    setTemplates(data);
  }

  useEffect(() => { refresh(); }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title || file.name);
      await client.post('/templates', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setTitle('');
      setFile(null);
      e.target.reset();
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function startRecord(templateId) {
    const { data } = await client.post('/records', { templateId });
    navigate(`/records/${data.id}`);
  }

  return (
    <div className="page">
      <h2>College templates</h2>
      <p className="muted">Blank Logbook / Practical Record PDFs provided by colleges.</p>

      {user?.role === 'admin' && (
        <form className="upload-form" onSubmit={handleUpload}>
          <h3>Upload a new template (college admin)</h3>
          <input
            type="text"
            placeholder="Title, e.g. Plumbing NVQ Level 2 Logbook"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
          <button className="btn btn-primary" disabled={busy || !file} type="submit">
            {busy ? 'Uploading…' : 'Upload PDF template'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}

      <div className="template-grid">
        {templates.map((t) => (
          <div key={t.id} className="card">
            <h3>{t.title}</h3>
            <p className="muted">{t.pageCount} page(s) · uploaded by {t.uploadedBy}</p>
            <div className="card-actions">
              {user?.role === 'admin' && (
                <button className="btn btn-secondary" onClick={() => navigate(`/templates/${t.id}/design`)}>
                  Design fields
                </button>
              )}
              <button className="btn btn-primary" onClick={() => startRecord(t.id)}>
                Fill a new record
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="muted">No templates yet.</p>}
      </div>
    </div>
  );
}
