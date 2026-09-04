import React, { useEffect, useRef, useState } from 'react';

/**
 * Renders a single PDF page onto a <canvas> using pdfjs, and provides a
 * same-sized wrapper <div> (position: relative) so callers can absolutely
 * position overlay children (form fields, drawing layer) on top of it.
 *
 * Overlay children should be positioned using PERCENTAGES of this wrapper's
 * width/height, not pixels — that way the same field/drawing coordinates
 * work no matter what zoom level or screen size the page is rendered at,
 * and map directly onto pdf-lib's page fractions during export.
 */
export default function PdfCanvasPage({ pdfDoc, pageNumber, containerWidth, onClick, children }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!pdfDoc) return;
      const page = await pdfDoc.getPage(pageNumber);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = (containerWidth || 800) / unscaledViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (e) { /* ignore */ }
      }
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        if (err && err.name !== 'RenderingCancelledException') throw err;
      }
      if (!cancelled) {
        setSize({ width: viewport.width, height: viewport.height });
      }
    }

    render();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, containerWidth]);

  function handleClick(e) {
    if (!onClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onClick({ xPct, yPct });
  }

  return (
    <div
      className="pdf-page-wrapper"
      style={{ width: size.width || containerWidth, height: size.height || 'auto' }}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} />
      <div className="pdf-page-overlay" style={{ width: size.width, height: size.height }}>
        {children}
      </div>
    </div>
  );
}
