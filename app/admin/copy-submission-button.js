"use client";

import { useState } from "react";

export default function CopySubmissionButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button type="button" className="secondary-button" onClick={copy}>
      {copied ? "Copied" : "Copy submission"}
    </button>
  );
}
