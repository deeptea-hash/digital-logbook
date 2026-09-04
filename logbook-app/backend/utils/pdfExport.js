const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Bakes the student's filled values, selections, and freehand drawings
 * directly onto the original template pages and returns the flattened
 * PDF bytes. "Flattened" here means: there is no longer any separate
 * editable form layer — it's now just permanent page content, safe to
 * hand to an exam board / verifier as a final record.
 *
 * Coordinate note: fields/drawings are stored as PERCENTAGES of the page
 * width/height, with origin at the TOP-LEFT (matching how they're captured
 * from the browser overlay). pdf-lib's coordinate origin is BOTTOM-LEFT,
 * so every y value is flipped: pdfY = pageHeight - topLeftY.
 */
async function exportFilledPdf({ templateBytes, fields, values, drawings }) {
  const pdfDoc = await PDFDocument.load(templateBytes, { updateMetadata: false });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const fieldsByPage = {};
  for (const f of fields) {
    fieldsByPage[f.page] = fieldsByPage[f.page] || [];
    fieldsByPage[f.page].push(f);
  }

  pages.forEach((page, pageIndex) => {
    const { width, height } = page.getSize();

    // ---- Draw form field values ----
    const pageFields = fieldsByPage[pageIndex] || [];
    for (const field of pageFields) {
      const boxX = (field.xPct / 100) * width;
      const boxTopY = height - (field.yPct / 100) * height;
      const boxW = (field.widthPct / 100) * width;
      const boxH = (field.heightPct / 100) * height;
      const boxBottomY = boxTopY - boxH;
      const value = values ? values[field.id] : undefined;

      if (field.type === 'text' || field.type === 'select') {
        const text = value == null ? '' : String(value);
        if (text.length > 0) {
          const fontSize = Math.min(11, Math.max(7, boxH * 0.6));
          page.drawText(text, {
            x: boxX + 2,
            y: boxBottomY + Math.max(2, (boxH - fontSize) / 2),
            size: fontSize,
            font,
            color: rgb(0.05, 0.05, 0.2),
            maxWidth: Math.max(boxW - 4, 10),
          });
        }
      } else if (field.type === 'checkbox') {
        if (value === true) {
          const cx = boxX + boxW / 2;
          const cy = boxBottomY + boxH / 2;
          const r = Math.min(boxW, boxH) / 2.5;
          page.drawLine({ start: { x: cx - r, y: cy - r }, end: { x: cx + r, y: cy + r }, thickness: 1.6, color: rgb(0, 0, 0) });
          page.drawLine({ start: { x: cx - r, y: cy + r }, end: { x: cx + r, y: cy - r }, thickness: 1.6, color: rgb(0, 0, 0) });
        }
      } else if (field.type === 'radio') {
        // For radios, `values[groupName]` holds the selected field's id.
        const groupValue = values ? values[field.groupName] : undefined;
        if (groupValue === field.id) {
          const cx = boxX + boxW / 2;
          const cy = boxBottomY + boxH / 2;
          const r = Math.min(boxW, boxH) / 3;
          page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, color: rgb(0, 0, 0) });
        }
      }
    }

    // ---- Draw freehand annotation strokes ----
    const strokes = (drawings && drawings[String(pageIndex)]) || [];
    for (const stroke of strokes) {
      const pts = stroke.points || [];
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        page.drawLine({
          start: { x: (p0.x / 100) * width, y: height - (p0.y / 100) * height },
          end: { x: (p1.x / 100) * width, y: height - (p1.y / 100) * height },
          thickness: stroke.width || 2,
          color: hexToRgbColor(stroke.color || '#1d4ed8'),
        });
      }
    }
  });

  return pdfDoc.save();
}

function hexToRgbColor(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r || 0, g || 0, b || 0);
}

module.exports = { exportFilledPdf };
