"use client";

import { useState } from "react";
import { copyText } from "./copy-text";

export default function CopySubmissionButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyText(text || "");
    setCopied(ok ? true : "error");
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className="secondary-button" onClick={copy}>
      {copied === "error" ? "Copy failed" : copied ? "Copied" : "Copy submission"}
    </button>
  );
}
