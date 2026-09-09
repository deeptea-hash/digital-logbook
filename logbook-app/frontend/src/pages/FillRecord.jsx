import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import usePdfDocument from '../usePdfDocument';
import PdfCanvasPage from '../components/PdfCanvasPage';
import FieldOverlay from '../components/FieldOverlay';
import DrawingLayer from '../components/DrawingLayer';

export default function FillRecord() {
  const { recordId } = useParams();
  const [record, setRecord] = useState(null);
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [drawings, setDrawings] = useState({}); // { [pageIndex]: stroke[] }
  const [drawMode, setDrawMode] = useState(false);
  const [versions, setVersions] = useState([]);
  const [status, setStatus] = useState('');

  const { pdfDoc, numPages } = usePdfDocument(record?.templateId);

  useEffect(() => {
    async function load() {
      const { data } = await client.get(`/records/${recordId}`);
      setRecord(data);
      const latest = data.versions[data.versions.length - 1];
      setValues(latest.values || {});
      setDrawings(latest.drawings || {});

      const fieldsRes = await client.get(`/templates/${data.templateId}/fields`);
      setFields(fieldsRes.data.fields || []);

      const versionsRes = await client.get(`/records/${recordId}/versions`);
      setVersions(versionsRes.data);
    }
    load();
  }, [recordId]);

  function handleFieldChange(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleStrokesChange(pageIndex, strokes) {
    setDrawings((prev) => ({ ...prev, [pageIndex]: strokes }));
  }

  async function handleSave() {
    setStatus('Saving…');
    const { data } = await client.put(`/records/${recordId}`, { values, drawings });
    setRecord(data);
    const versionsRes = await client.get(`/records/${recordId}/versions`);
    setVersions(versionsRes.data);
    setStatus('Saved as version ' + data.currentVersion);
    setTimeout(() => setStatus(''), 2000);
  }

  async function handleLoadVersion(versionNum) {
    const { data } = await client.get(`/records/${recordId}/versions/${versionNum}`);
    setValues(data.values || {});
    setDrawings(data.drawings || {});
    setStatus(`Loaded version ${versionNum} (not yet saved as current)`);
  }

  async function handleExport() {
    setStatus('Exporting…');
    const response = await client.post(
      `/records/${recordId}/export`,
      {},
      { responseType: 'blob' }
    );
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.templateTitle || 'logbook'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    setStatus('Exported!');
    setTimeout(() => setStatus(''), 2000);
  }

  if (!record) return <div className="page"><p className="muted">Loading record…</p></div>;

  return (
    <div className="page">
      <h2>{record.templateTitle}</h2>
      <p className="muted">Record {record.id.slice(0, 8)} · current version {record.currentVersion}</p>

      <div className="fill-toolbar">
        <button className="btn btn-primary" onClick={handleSave}>Save draft</button>
        <button className="btn btn-secondary" onClick={handleExport}>Export flattened PDF</button>
        <label className="draw-toggle">
          <input type="checkbox" checked={drawMode} onChange={(e) => setDrawMode(e.target.checked)} />
          Freehand drawing mode
        </label>
        <select onChange={(e) => e.target.value && handleLoadVersion(Number(e.target.value))} defaultValue="">
          <option value="" disabled>Reopen a previous version…</option>
          {versions.map((v) => (
            <option key={v.version} value={v.version}>
              v{v.version} — {new Date(v.savedAt).toLocaleString()}
            </option>
          ))}
        </select>
        {status && <span className="muted">{status}</span>}
      </div>

      {!pdfDoc && <p className="muted">Loading PDF…</p>}

      {Array.from({ length: numPages }).map((_, pageIndex) => (
        <PageBlock
          key={pageIndex}
          pageIndex={pageIndex}
          pdfDoc={pdfDoc}
          fields={fields.filter((f) => f.page === pageIndex)}
          values={values}
          onFieldChange={handleFieldChange}
          drawMode={drawMode}
          strokes={drawings[pageIndex] || []}
          onStrokesChange={(strokes) => handleStrokesChange(pageIndex, strokes)}
        />
      ))}
    </div>
  );
}

/** Wraps one page + its overlay fields + its drawing layer, tracking rendered size. */
function PageBlock({ pageIndex, pdfDoc, fields, values, onFieldChange, drawMode, strokes, onStrokesChange }) {
  const [size, setSize] = useState({ width: 900, height: 1200 });

  return (
    <div className="pdf-page-block">
      <div className="page-label">Page {pageIndex + 1}</div>
      <div style={{ position: 'relative', width: 900 }}>
        <PdfCanvasPage pdfDoc={pdfDoc} pageNumber={pageIndex + 1} containerWidth={900}>
          {fields.map((f) => (
            <FieldOverlay
              key={f.id}
              field={f}
              mode="fill"
              value={values[f.id]}
              groupValue={f.type === 'radio' ? values[f.groupName] : undefined}
              onChange={onFieldChange}
            />
          ))}
        </PdfCanvasPage>
        <PageSizeWatcher onSize={setSize} width={900} pdfDoc={pdfDoc} pageNumber={pageIndex + 1} />
        <div className="drawing-layer-wrap" style={{ position: 'absolute', inset: 0, width: size.width, height: size.height, pointerEvents: drawMode ? 'auto' : 'none' }}>
          <DrawingLayer
            width={size.width}
            height={size.height}
            strokes={strokes}
            active={drawMode}
            onStrokesChange={onStrokesChange}
          />
        </div>
      </div>
    </div>
  );
}

/** Small helper: computes the same viewport size PdfCanvasPage uses, so the drawing layer can match it exactly. */
function PageSizeWatcher({ pdfDoc, pageNumber, width, onSize }) {
  useEffect(() => {
    let cancelled = false;
    async function compute() {
      if (!pdfDoc) return;
      const page = await pdfDoc.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = width / unscaled.width;
      const viewport = page.getViewport({ scale });
      if (!cancelled) onSize({ width: viewport.width, height: viewport.height });
    }
    compute();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, width]);
  return null;
}

