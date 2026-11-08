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

export default function MyVaults() {
  const { address, isConnected } = useAccount();
  const vaults = useReadContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "vaultsOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && FACTORY) },
  });

  if (!isDeployed) return <div className="py-10"><NotDeployed /></div>;

  if (!isConnected)
    return (
      <div className="py-16 max-w-xl space-y-4">
        <h1 className="text-3xl font-bold">Your vaults</h1>
        <p className="text-muted">Connect with Base Account (Face ID, no extension) or any browser wallet. Mora runs on Base Sepolia testnet.</p>
        <ConnectButton />
      </div>
    );

  const list = (vaults.data as readonly Address[] | undefined) ?? [];

  return (
    <div className="py-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">Your vaults</h1>
        {list.length === 0 && <p className="text-muted">No vaults yet. Create one on the right.</p>}
        {list.map((v) => (
          <Link key={v} href={`/vault/${v}`} className="card p-4 flex items-center justify-between hover:border-moon">
            <span className="font-mono">{short(v)}</span>
            <span className="text-sm text-moon">Open →</span>
          </Link>
        ))}
      </section>
      <CreateVault owner={address!} onCreated={() => vaults.refetch()} />
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
    if (recovery.toLowerCase() === owner.toLowerCase()) return setProblem("Use a different wallet for recovery, ideally a cold wallet, not the one you’re connected with.");
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
    <section className="card p-5 sm:p-6 space-y-4">
      <h2 className="text-xl font-semibold">Create a vault</h2>
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
      <button className="btn btn-moon w-full" onClick={submit} disabled={tx.busy}>
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
