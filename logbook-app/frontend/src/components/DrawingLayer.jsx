import React, { useEffect, useRef, useState } from 'react';

/**
 * A transparent canvas laid on top of a PDF page for basic freehand
 * annotation. Strokes are stored as arrays of {x, y} points expressed as
 * PERCENTAGES of the page, so they survive being redrawn at a different
 * canvas pixel size and map directly onto pdf-lib coordinates on export.
 */
export default function DrawingLayer({ width, height, strokes, active, color = '#1d4ed8', lineWidth = 2, onStrokesChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  // Redraw everything whenever strokes or size change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    for (const stroke of strokes || []) {
      drawStroke(ctx, stroke, width, height);
    }
  }, [strokes, width, height]);

  function drawStroke(ctx, stroke, w, h) {
    const pts = stroke.points || [];
    if (pts.length < 2) return;
    ctx.strokeStyle = stroke.color || '#1d4ed8';
    ctx.lineWidth = stroke.width || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo((pts[0].x / 100) * w, (pts[0].y / 100) * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo((pts[i].x / 100) * w, (pts[i].y / 100) * h);
    }
    ctx.stroke();
  }

  function toPct(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }

  function handlePointerDown(e) {
    if (!active) return;
    e.preventDefault();
    drawingRef.current = true;
    currentStrokeRef.current = { color, width: lineWidth, points: [toPct(e)] };
    canvasRef.current.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!active || !drawingRef.current) return;
    const pt = toPct(e);
    currentStrokeRef.current.points.push(pt);

    // Live-draw the in-progress stroke for immediate feedback.
    const ctx = canvasRef.current.getContext('2d');
    const pts = currentStrokeRef.current.points;
    const p0 = pts[pts.length - 2];
    const p1 = pts[pts.length - 1];
    if (p0 && p1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo((p0.x / 100) * width, (p0.y / 100) * height);
      ctx.lineTo((p1.x / 100) * width, (p1.y / 100) * height);
      ctx.stroke();
    }
  }

  function handlePointerUp() {
    if (!active || !drawingRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke && stroke.points.length > 1) {
      onStrokesChange([...(strokes || []), stroke]);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="drawing-layer"
      style={{ pointerEvents: active ? 'auto' : 'none', cursor: active ? 'crosshair' : 'default' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
