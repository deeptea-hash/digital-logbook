import React from 'react';

/**
 * Renders one interactive field (text/checkbox/radio/select) positioned
 * absolutely over a PDF page, using percentage coordinates so it lines up
 * regardless of render scale.
 *
 * In "design" mode (editable=false interactions disabled, but a delete
 * button and label shown) it's used by the template designer to place and
 * label fields. In "fill" mode it's a live input bound to record values.
 */
export default function FieldOverlay({ field, mode, value, groupValue, onChange, onDelete }) {
  const style = {
    position: 'absolute',
    left: `${field.xPct}%`,
    top: `${field.yPct}%`,
    width: `${field.widthPct}%`,
    height: `${field.heightPct}%`,
  };

  if (mode === 'design') {
    return (
      <div className="field-box field-box-design" style={style} title={field.label}>
        <span className="field-badge">{field.type}{field.type === 'radio' ? `:${field.groupName || '?'}` : ''}</span>
        <button
          type="button"
          className="field-delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(field.id); }}
        >
          ×
        </button>
      </div>
    );
  }

  // --- fill mode ---
  if (field.type === 'text') {
    return (
      <input
        className="field-input field-text"
        style={style}
        value={value || ''}
        placeholder={field.label}
        onChange={(e) => onChange(field.id, e.target.value)}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="field-checkbox-wrap" style={style} title={field.label}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field.id, e.target.checked)}
        />
      </label>
    );
  }

  if (field.type === 'radio') {
    return (
      <label className="field-checkbox-wrap" style={style} title={field.label}>
        <input
          type="radio"
          name={field.groupName}
          checked={groupValue === field.id}
          onChange={() => onChange(field.groupName, field.id)}
        />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className="field-input field-select"
        style={style}
        value={value || ''}
        onChange={(e) => onChange(field.id, e.target.value)}
      >
        <option value="">{field.label || 'Select...'}</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  return null;
}
