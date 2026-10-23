"use client";

import { useState } from "react";

export default function CopyPortalLinkButton({ url }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button type="button" className="secondary-button" onClick={copy}>
      {copied ? "Copied" : "Copy portal link"}
    </button>
  );
}
