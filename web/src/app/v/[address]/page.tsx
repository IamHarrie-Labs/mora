"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { isDeployed } from "@/lib/config";
import { curfewLabel, duration, localTime, short, usd } from "@/lib/format";
import { PENDING, useNow, useVault } from "@/lib/hooks";
import { Moon } from "@/components/Header";
import { NotDeployed } from "@/components/NotDeployed";

/** The "sign on the door": what anyone could take from this vault right now, read live from Base. */
export default function PublicVault() {
  const params = useParams<{ address: string }>();
  const vault = isAddress(params.address) ? (params.address as Address) : undefined;
  const v = useVault(vault);
  const now = useNow();
  const [copied, setCopied] = useState(false);

  if (!isDeployed) return <div className="py-10"><NotDeployed /></div>;
  if (!vault) return <p className="py-10 text-bad">That isn’t a valid vault address.</p>;
  if (v.loading) return <p className="py-10 text-muted">Reading the vault from Base…</p>;
  if (!v.ready) return <p className="py-10 text-bad">Couldn’t read this vault.</p>;

  const frozen = v.frozenUntil > now;
  const nextUnlock = v.withdrawals.filter((w) => w.status === PENDING).map((w) => w.unlockAt).sort((a, b) => a - b)[0];

  return (
    <div className="py-12 flex justify-center">
      <div className="card w-full max-w-xl p-6 sm:p-10 text-center space-y-6">
        <div className="flex items-center justify-center gap-2 text-muted text-sm">
          <Moon size={18} /> Protected by Mora · <span className="font-mono">{short(vault)}</span>
        </div>
        <div>
          <div className="text-muted">The most anyone can take from this vault right now</div>
          <div className={`text-6xl sm:text-7xl font-bold mt-2 ${v.maxExtractable === 0n ? "text-good" : "text-moon"}`}>{usd(v.maxExtractable)}</div>
        </div>
        <ul className="text-sm text-left space-y-2 max-w-sm mx-auto">
          <li>• Anything more waits <b>{duration(v.rules.delay)}</b>, and nothing leaves instantly during curfew ({curfewLabel(v.rules.curfewStart, v.rules.curfewEnd)}).</li>
          <li>• <b>{v.guardians.length}</b> guardian{v.guardians.length === 1 ? "" : "s"} can cancel any transfer or send everything to a recovery address set in advance.</li>
          <li>• Changing these rules also waits {duration(v.rules.delay)}.</li>
          {frozen && <li className="text-info">• Frozen right now: nothing can leave for {duration(v.frozenUntil - now)}.</li>}
          {nextUnlock && <li>• Next scheduled unlock: {localTime(nextUnlock)}.</li>}
        </ul>
        <p className="text-xs text-muted">Read live from the vault contract on Base Sepolia. Nobody, including the owner, can override this.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            }}
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <Link href="/demo" className="btn btn-moon">How Mora works</Link>
        </div>
      </div>
    </div>
  );
}
