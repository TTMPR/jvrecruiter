"use client";

import { useEffect, useRef, useState } from "react";

export default function RichTextEditor({ name, label, initialValue = "", rows = 6, placeholder = "" }) {
  const [value, setValue] = useState(initialValue || "");
  const ref = useRef(null);

  useEffect(() => {
    setValue(initialValue || "");
  }, [initialValue]);

  function replaceSelection(transform) {
    const textarea = ref.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const result = transform(selected, value, start, end);
    const next = value.slice(0, start) + result.text + value.slice(end);

    setValue(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorStart = start + (result.selectionStart ?? 0);
      const cursorEnd = start + (result.selectionEnd ?? result.text.length);
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function wrap(prefix, suffix, fallback) {
    replaceSelection((selected) => {
      const content = selected || fallback;
      const text = prefix + content + suffix;
      return {
        text,
        selectionStart: prefix.length,
        selectionEnd: prefix.length + content.length
      };
    });
  }

  function makeList(type) {
    replaceSelection((selected) => {
      const source = selected || "List item";
      const lines = source.split("\n");
      const text = lines
        .map((line, index) => {
          const clean = line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
          return type === "ordered" ? `${index + 1}. ${clean}` : `- ${clean}`;
        })
        .join("\n");

      return { text };
    });
  }

  return (
    <label className="rich-editor-field">
      <span>{label}</span>
      <div className="rich-editor">
        <div className="rich-toolbar" role="toolbar" aria-label={`${label} formatting`}>
          <button type="button" onClick={() => wrap("**", "**", "Bold text")} title="Bold"><strong>B</strong></button>
          <button type="button" onClick={() => wrap("*", "*", "Italic text")} title="Italic"><em>I</em></button>
          <button type="button" onClick={() => makeList("unordered")} title="Bulleted list">• List</button>
          <button type="button" onClick={() => makeList("ordered")} title="Numbered list">1. List</button>
        </div>
        <textarea
          ref={ref}
          name={name}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <small className="format-hint">Supports bold, italic, bullets and numbered lists.</small>
    </label>
  );
}
