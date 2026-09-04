import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import usePdfDocument from '../usePdfDocument';
import PdfCanvasPage from '../components/PdfCanvasPage';
import FieldOverlay from '../components/FieldOverlay';

const DEFAULT_SIZE = { widthPct: 18, heightPct: 3.5 };

let localIdCounter = 0;
function newFieldId() {
  localIdCounter += 1;
  return `f_${Date.now()}_${localIdCounter}`;
}

export default function TemplateDesigner() {
  const { templateId } = useParams();
  const { pdfDoc, numPages } = usePdfDocument(templateId);
  const [fields, setFields] = useState([]);
  const [placingType, setPlacingType] = useState('text');
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    client.get(`/templates/${templateId}/fields`).then((res) => setFields(res.data.fields || []));
  }, [templateId]);

  function handlePageClick(pageIndex, { xPct, yPct }) {
    const label = window.prompt('Field label (shown as placeholder / tooltip):', '') || '';

    let options = [];
    let groupName = '';
    if (placingType === 'select') {
      const raw = window.prompt('Options, comma-separated:', 'Option A, Option B') || '';
      options = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (placingType === 'radio') {
      groupName = window.prompt('Radio group name (fields sharing this name act as one choice):', 'group1') || 'group1';
    }

    const field = {
      id: newFieldId(),
      type: placingType,
      page: pageIndex,
      xPct,
      yPct,
      ...DEFAULT_SIZE,
      label,
      options,
      groupName,
    };
    setFields((prev) => [...prev, field]);
  }

  function handleDelete(fieldId) {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
  }

  async function handleSave() {
    setSaveMsg('Saving…');
    await client.post(`/templates/${templateId}/fields`, { fields });
    setSaveMsg('Saved!');
    setTimeout(() => setSaveMsg(''), 1500);
  }

  return (
    <div className="page">
      <h2>Template designer</h2>
      <p className="muted">
        Click "add field" then click anywhere on the PDF to drop a field there. This defines
        where students' answers will be captured and printed back onto the exported PDF.
      </p>

      <div className="designer-toolbar">
        <label>New field type:</label>
        <select value={placingType} onChange={(e) => setPlacingType(e.target.value)}>
          <option value="text">Text input</option>
          <option value="checkbox">Checkbox</option>
          <option value="radio">Radio button</option>
          <option value="select">Dropdown / select</option>
        </select>
        <span className="muted">→ click on the page below to place it</span>
        <button className="btn btn-primary" onClick={handleSave}>Save field layout</button>
        {saveMsg && <span className="muted">{saveMsg}</span>}
      </div>

      {!pdfDoc && <p className="muted">Loading PDF…</p>}

      {Array.from({ length: numPages }).map((_, pageIndex) => (
        <div key={pageIndex} className="pdf-page-block">
          <div className="page-label">Page {pageIndex + 1}</div>
          <PdfCanvasPage
            pdfDoc={pdfDoc}
            pageNumber={pageIndex + 1}
            containerWidth={900}
            onClick={(pct) => handlePageClick(pageIndex, pct)}
          >
            {fields.filter((f) => f.page === pageIndex).map((f) => (
              <FieldOverlay key={f.id} field={f} mode="design" onDelete={handleDelete} />
            ))}
          </PdfCanvasPage>
        </div>
      ))}
    </div>
  );
}
