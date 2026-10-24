"use client";

import { useState } from "react";
import { copyText } from "./copy-text";

export default function CopyPortalInviteButton({ candidateName, roleTitle, portalUrl }) {
  const [copied, setCopied] = useState(false);

  const firstName = String(candidateName || "").split(" ")[0] || "there";
  const message = [
    `Hi ${firstName},`,
    "",
    `I created a private JVRecruit portal for your ${roleTitle} application.`,
    "You can use it to check your application status, view upcoming interviews, update your information or résumé, and withdraw from the process if needed.",
    "",
    portalUrl,
    "",
    "Please keep this link private."
  ].join("\n");

  async function copy() {
    const ok = await copyText(message);
    setCopied(ok ? true : "error");
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className="secondary-button" onClick={copy}>
      {copied === "error" ? "Copy failed" : copied ? "Invitation copied" : "Copy invitation"}
    </button>
  );
}
