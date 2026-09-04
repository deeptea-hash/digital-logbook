import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

export default function MyRecords() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    client.get('/records').then((res) => setRecords(res.data));
  }, []);

  async function quickExport(id, title) {
    const response = await client.post(`/records/${id}/export`, {}, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'logbook'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <h2>My records</h2>
      <p className="muted">Drafts and submissions saved under your account.</p>

      <div className="record-list">
        {records.map((r) => (
          <div key={r.id} className="card">
            <h3>{r.templateTitle}</h3>
            <p className="muted">
              Version {r.currentVersion} of {r.versionCount} · last updated {new Date(r.updatedAt).toLocaleString()}
            </p>
            <div className="card-actions">
              <Link className="btn btn-secondary" to={`/records/${r.id}`}>Open / edit</Link>
              <button className="btn btn-primary" onClick={() => quickExport(r.id, r.templateTitle)}>
                Download PDF
              </button>
            </div>
          </div>
        ))}
        {records.length === 0 && <p className="muted">No records yet — start one from the Templates page.</p>}
      </div>
    </div>
  );
}
