"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { isDeployed } from "@/lib/config";
import { curfewLabel, duration, localTime, short, usd } from "@/lib/format";
import { PENDING, useNow, useVault } from "@/lib/hooks";
import { Mark } from "@/components/Logo";
import { AlertsCard } from "@/components/AlertsCard";
import { NotDeployed } from "@/components/NotDeployed";

/** The "sign on the door": what anyone could take from this vault right now, read live from Base. */
export default function PublicVault() {
  const params = useParams<{ address: string }>();
  const vault = isAddress(params.address) ? (params.address as Address) : undefined;
  const v = useVault(vault);
  const now = useNow();
  const [copied, setCopied] = useState(false);

  if (!isDeployed) return <div className="wrap py-10"><NotDeployed /></div>;
  if (!vault) return <p className="wrap py-16 text-bad">That isn’t a valid vault address.</p>;
  if (v.loading) return <p className="wrap py-16 text-muted">Reading the vault from Base…</p>;
  if (!v.ready) return <p className="wrap py-16 text-bad">Couldn’t read this vault.</p>;

  const frozen = v.frozenUntil > now;
  const nextUnlock = v.withdrawals.filter((w) => w.status === PENDING).map((w) => w.unlockAt).sort((a, b) => a - b)[0];

  const safe = v.maxExtractable === 0n;

  return (
    <div className="wrap py-10 sm:py-16">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[28px] border-[1.5px] border-black shadow-[10px_10px_0_#111]">
        <div className={`relative overflow-hidden px-6 pt-8 pb-0 sm:px-12 sm:pt-12 ${safe ? "bg-sun" : "bg-white"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
            <span className="flex items-center gap-2"><Mark size={30} /> Protected by Mora</span>
            <span className="num">{short(vault)}</span>
          </div>
          <div className="mt-10 max-w-md text-lg font-medium">The most anyone can take from this vault right now</div>
          <div className="big-num mt-3 text-[clamp(88px,18vw,168px)]">{usd(v.maxExtractable)}</div>
          <Mark size={600} className="mt-6 block w-full translate-y-[2px] text-black" />
        </div>
        <div className="bg-white px-6 py-8 sm:px-12">
          <ul className="grid gap-5 sm:grid-cols-2">
            <li className="border-t-[1.5px] border-black pt-3">
              <div className="stat-label">The wait</div>
              <p className="mt-2">Anything more waits <b>{duration(v.rules.delay)}</b>{v.rules.curfewStart === v.rules.curfewEnd ? "." : <>. Nothing leaves instantly during curfew, {curfewLabel(v.rules.curfewStart, v.rules.curfewEnd)}.</>}</p>
            </li>
            <li className="border-t-[1.5px] border-black pt-3">
              <div className="stat-label">Guardians</div>
              <p className="mt-2"><b>{v.guardians.length}</b> {v.guardians.length === 1 ? "person" : "people"} can cancel any transfer or send everything to a recovery address chosen in advance.</p>
            </li>
            <li className="border-t-[1.5px] border-black pt-3">
              <div className="stat-label">Rule changes</div>
              <p className="mt-2">Loosening any rule also waits {duration(v.rules.delay)}.</p>
            </li>
            <li className="border-t-[1.5px] border-black pt-3">
              <div className="stat-label">Right now</div>
              <p className="mt-2">
                {frozen ? `Frozen. Nothing can leave for ${duration(v.frozenUntil - now)}.` : nextUnlock ? `Next scheduled unlock: ${localTime(nextUnlock)}.` : "Nothing is waiting in the queue."}
              </p>
            </li>
          </ul>
          <p className="mt-8 text-xs text-muted">Read live from the vault contract on Base Sepolia. The owner cannot override these rules.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <AlertsCard vault={vault} compact />
            <button
              className="btn btn-ghost"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? "Link copied" : "Copy link"}
            </button>
            <Link href="/demo" className="btn btn-ghost">How Mora works</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
