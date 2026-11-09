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
      <a href={link} target="_blank" rel="noreferrer" className="btn btn-moon">
        Get Telegram alerts
      </a>
    );
  }

  return (
    <section className="space-y-3 rounded-[22px] border-[1.5px] border-black bg-sun p-6">
      <h2 className="panel-title">Guardian alerts</h2>
      <p className="text-sm">
        A delay helps when someone notices. Guardians get a Telegram message within about 5 minutes of any withdrawal
        request or rule change, with a button back here to cancel or rescue.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={link} target="_blank" rel="noreferrer" className="btn btn-moon">Get alerts on Telegram</a>
        <button className="btn btn-ghost bg-white" onClick={copy}>{copied ? "Copied" : "Copy link for your guardians"}</button>
      </div>
      <p className="text-xs break-all">
        Or message <span className="font-mono">@{ALERT_BOT}</span> with <span className="font-mono">/watch {vault}</span>
      </p>
    </section>
  );
}
