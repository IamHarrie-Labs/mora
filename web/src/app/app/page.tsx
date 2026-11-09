"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { factoryAbi } from "@/lib/abi";
import { FACTORY, isDeployed } from "@/lib/config";
import { hhmmToMin, localToUtcMin, short, toUnits } from "@/lib/format";
import { useTx } from "@/lib/hooks";
import { NotDeployed } from "@/components/NotDeployed";
import { TxStatus } from "@/components/TxStatus";
import { ConnectButton } from "@/components/ConnectButton";
import { Mark } from "@/components/Logo";

export default function MyVaults() {
  const { address, isConnected } = useAccount();
  const vaults = useReadContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "vaultsOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && FACTORY) },
  });

  if (!isDeployed) return <div className="wrap py-10"><NotDeployed /></div>;

  if (!isConnected)
    return (
      <div className="wrap">
        <div className="grid items-center gap-12 py-16 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="eyebrow">Your vaults</span>
            <h1 className="page-title mt-5">Connect a wallet to make a vault.</h1>
            <p className="lede mt-5 max-w-xl text-muted">
              Base Account signs in with Face ID or a passkey, with no extension to install. Any browser wallet works too. Mora runs on
              Base Sepolia testnet, so use test money.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <ConnectButton />
              <Link href="/demo" className="link-arrow">Try the demo first →</Link>
            </div>
          </div>
          <div className="relative hidden justify-center lg:flex">
            <div className="halftone absolute h-[320px] w-[320px] text-[#e2d4ad]" />
            <Mark size={340} className="relative mt-24 text-black" />
          </div>
        </div>
      </div>
    );

  const list = (vaults.data as readonly Address[] | undefined) ?? [];

  return (
    <div className="wrap">
      <div className="page-head">
        <span className="eyebrow">Your vaults</span>
        <h1 className="page-title mt-5">{list.length ? "Your vaults" : "Make your first vault"}</h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
      <section className="space-y-3">
        {list.length === 0 && (
          <div className="rounded-[22px] bg-sun p-6">
            <p className="h-md">No vaults yet.</p>
            <p className="mt-3 text-[15px]">Pick your rules in the form. You can tighten them later at once, and loosening them waits the delay.</p>
          </div>
        )}
        {list.map((v) => (
          <Link key={v} href={`/vault/${v}`} className="group flex items-center justify-between rounded-[18px] border-[1.5px] border-black bg-white p-5 transition-shadow hover:shadow-[5px_5px_0_#111]">
            <span className="flex items-center gap-3"><Mark size={34} /><span className="num">{short(v)}</span></span>
            <span className="text-sm font-semibold">Open →</span>
          </Link>
        ))}
      </section>
      <CreateVault owner={address!} onCreated={() => vaults.refetch()} />
      </div>
    </div>
  );
}

function CreateVault({ owner, onCreated }: { owner: Address; onCreated: () => void }) {
  const router = useRouter();
  const [limit, setLimit] = useState("200");
  const [delayH, setDelayH] = useState("12");
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("07:00");
  const [recovery, setRecovery] = useState("");
  const [guardians, setGuardians] = useState("");
  const tx = useTx(onCreated);
  const [problem, setProblem] = useState<string>();

  const guardianList = guardians.split(/[\s,]+/).map((g) => g.trim()).filter(Boolean);

  async function submit() {
    setProblem(undefined);
    if (!isAddress(recovery)) return setProblem("Recovery address must be a valid 0x address (a wallet you keep offline).");
    if (recovery.toLowerCase() === owner.toLowerCase()) return setProblem("Pick a different wallet for recovery. A cold wallet you keep offline works best.");
    const bad = guardianList.find((g) => !isAddress(g) || g.toLowerCase() === owner.toLowerCase());
    if (bad) return setProblem(`Guardian ${bad} isn’t valid (and can’t be your own address).`);
    if (guardianList.length > 5) return setProblem("Up to 5 guardians.");
    const delay = Math.round(Number(delayH) * 3600);
    if (!(delay >= 3600 && delay <= 30 * 86400)) return setProblem("Delay must be between 1 hour and 30 days.");
    const rules = {
      dailyLimit: toUnits(limit),
      delay,
      curfewStart: localToUtcMin(hhmmToMin(start)),
      curfewEnd: localToUtcMin(hhmmToMin(end)),
    };
    await tx.send({ address: FACTORY!, abi: factoryAbi, functionName: "createVault", args: [recovery as Address, rules, guardianList as Address[]] });
    router.refresh();
  }

  return (
    <section className="space-y-5 rounded-[22px] border-[1.5px] border-black bg-white p-6 shadow-[8px_8px_0_#111] sm:p-8">
      <h2 className="h-md">Create a vault</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instant allowance per day (USDC)">
          <input className="input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </Field>
        <Field label="Delay for everything else">
          <select className="input" value={delayH} onChange={(e) => setDelayH(e.target.value)}>
            {["1", "6", "12", "24", "48", "72"].map((h) => (
              <option key={h} value={h}>{h} hours</option>
            ))}
          </select>
        </Field>
        <Field label="Curfew starts (your time)">
          <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Curfew ends (your time)">
          <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="Recovery address: where Rescue sends everything (use a cold wallet)">
        <input className="input font-mono" placeholder="0x…" value={recovery} onChange={(e) => setRecovery(e.target.value.trim())} />
      </Field>
      <Field label="Guardians: up to 5 addresses of people you trust, separated by commas">
        <textarea className="input font-mono" rows={2} placeholder="0x…, 0x…" value={guardians} onChange={(e) => setGuardians(e.target.value)} />
      </Field>
      <p className="text-xs text-muted">
        Set start and end to the same time for no curfew. Curfew is stored in UTC using today’s time-zone offset. Tightening rules
        later is instant; loosening them waits the delay.
      </p>
      {problem && <p className="text-sm text-bad">{problem}</p>}
      <button className="btn btn-moon btn-lg w-full" onClick={submit} disabled={tx.busy}>
        {tx.busy ? "Creating…" : "Create vault"}
      </button>
      <TxStatus hash={tx.hash} busy={tx.busy} error={tx.error} />
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
