"use client";

import { explorer } from "@/lib/config";

export function TxStatus({ hash, busy, error }: { hash?: string; busy?: boolean; error?: Error | null }) {
  if (error) {
    const msg = (error as { shortMessage?: string }).shortMessage || error.message;
    return <p className="text-sm text-bad break-words">{msg.split("\n")[0]}</p>;
  }
  if (!hash) return null;
  return (
    <p className="text-sm text-muted">
      {busy ? "Waiting for Base… " : "Done. "}
      <a className="underline" href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
        View on Basescan
      </a>
    </p>
  );
}
