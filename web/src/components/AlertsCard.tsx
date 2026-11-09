"use client";

import { useState } from "react";
import { ALERT_BOT, alertLink } from "@/lib/config";

/** Telegram guardian alerts: one tap to subscribe, plus a link the owner can send to guardians. */
export function AlertsCard({ vault, compact = false }: { vault: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = alertLink(vault);
  if (!link) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the link is still visible to copy by hand */
    }
  };

  if (compact) {
    return (
      <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost">
        Get Telegram alerts for this vault
      </a>
    );
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="font-semibold">Guardian alerts</div>
      <p className="text-sm text-muted">
        A delay only helps if someone notices. Guardians get a Telegram message within about 5 minutes of any withdrawal
        request or rule change, with a button back here to cancel or rescue.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={link} target="_blank" rel="noreferrer" className="btn btn-moon">Get alerts on Telegram</a>
        <button className="btn btn-ghost" onClick={copy}>{copied ? "Copied" : "Copy link for your guardians"}</button>
      </div>
      <p className="text-xs text-muted break-all">
        Or message <span className="font-mono">@{ALERT_BOT}</span> with <span className="font-mono">/watch {vault}</span>
      </p>
    </section>
  );
}
