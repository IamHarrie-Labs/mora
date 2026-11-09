"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { tokenAbi, vaultAbi } from "@/lib/abi";
import { USDC, canMintTestUsdc, explorer, isDeployed } from "@/lib/config";
import { curfewLabel, duration, hhmmToMin, localTime, localToUtcMin, minToHHMM, short, toUnits, usd, utcToLocalMin } from "@/lib/format";
import { PENDING, useNow, useTx, useVault, type QueuedWithdrawal } from "@/lib/hooks";
import { AlertsCard } from "@/components/AlertsCard";
import { NotDeployed } from "@/components/NotDeployed";
import { TxStatus } from "@/components/TxStatus";

const STATUS = ["", "Waiting", "Sent", "Cancelled"];

export default function VaultPage() {
  const params = useParams<{ address: string }>();
  const vault = isAddress(params.address) ? (params.address as Address) : undefined;
  const v = useVault(vault);
  const { address: me } = useAccount();
  const now = useNow();

  if (!isDeployed) return <div className="py-10"><NotDeployed /></div>;
  if (!vault) return <p className="py-10 text-bad">That isn’t a valid vault address.</p>;
  if (v.loading) return <p className="py-10 text-muted">Loading vault…</p>;
  if (!v.ready) return <p className="py-10 text-bad">Couldn’t read this vault. Is it a Mora vault on Base Sepolia?</p>;

  const isOwner = me?.toLowerCase() === v.owner.toLowerCase();
  const isGuardian = Boolean(me && v.guardians.some((g) => g.toLowerCase() === me.toLowerCase()));
  const role = isOwner ? "Owner" : isGuardian ? "Guardian" : "Viewer";
  const frozen = v.frozenUntil > now;
  const pendingW = v.withdrawals.filter((w) => w.status === PENDING);
  const pendingC = v.changes.filter((c) => c.status === PENDING);

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Vault <span className="font-mono">{short(vault)}</span></h1>
        <span className="rounded-full border border-line px-3 py-1 text-xs">You: {role}</span>
        {frozen && <span className="rounded-full bg-info/20 text-info px-3 py-1 text-xs">Frozen for {duration(v.frozenUntil - now)}</span>}
        <Link href={`/v/${vault}`} className="ml-auto btn btn-ghost">Public page</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="In the vault" value={usd(v.balance)} />
        <Stat label="Most anyone can take right now" value={usd(v.maxExtractable)} tone={v.maxExtractable === 0n ? "good" : "moon"} />
        <Stat label="Instant allowance" value={`${usd(v.rules.dailyLimit)}/day`} sub="refills gradually" />
        <Stat label="Everything else waits" value={duration(v.rules.delay)} sub={`Curfew: ${curfewLabel(v.rules.curfewStart, v.rules.curfewEnd)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {isOwner && <OwnerMoney vault={vault} refetch={v.refetch} />}
          <Queue vault={vault} items={v.withdrawals} now={now} canCancel={isOwner || isGuardian} frozen={frozen} refetch={v.refetch} />
        </div>
        <div className="space-y-6">
          {(isOwner || isGuardian) && <Emergency vault={vault} recovery={v.recovery} refetch={v.refetch} pending={pendingW.length + pendingC.length} />}
          <AlertsCard vault={vault} />
          <People owner={v.owner} recovery={v.recovery} guardians={v.guardians} />
          <Changes vault={vault} items={v.changes} now={now} canCancel={isOwner || isGuardian} frozen={frozen} refetch={v.refetch} />
          {isOwner && <Settings vault={vault} rules={v.rules} guardians={v.guardians} refetch={v.refetch} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "moon" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === "good" ? "text-good" : tone === "moon" ? "text-moon" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function OwnerMoney({ vault, refetch }: { vault: Address; refetch: () => void }) {
  const { address: me } = useAccount();
  const [dep, setDep] = useState("500");
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const tx = useTx(useCallback(() => refetch(), [refetch]));

  return (
    <Panel title="Move money">
      <div className="space-y-2">
        <span className="label">Deposit USDC from your wallet</span>
        <div className="flex gap-2">
          <input className="input" inputMode="decimal" value={dep} onChange={(e) => setDep(e.target.value)} />
          <button
            className="btn btn-ghost shrink-0"
            disabled={tx.busy}
            onClick={() => tx.send({ address: USDC!, abi: tokenAbi, functionName: "transfer", args: [vault, toUnits(dep)] })}
          >
            Deposit
          </button>
        </div>
        {canMintTestUsdc && me && (
          <button
            className="text-xs underline text-muted"
            disabled={tx.busy}
            onClick={() => tx.send({ address: USDC!, abi: tokenAbi, functionName: "mint", args: [me, toUnits("1000")] })}
          >
            Get 1,000 test USDC (testnet only)
          </button>
        )}
      </div>
      <div className="space-y-2 pt-3 border-t border-line">
        <span className="label">Withdraw. Within the allowance and outside curfew it’s instant; otherwise it waits the delay.</span>
        <input className="input font-mono" placeholder="To 0x…" value={to} onChange={(e) => setTo(e.target.value.trim())} />
        <div className="flex gap-2">
          <input className="input" inputMode="decimal" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
          <button
            className="btn btn-moon shrink-0"
            disabled={tx.busy || !isAddress(to) || !Number(amt)}
            onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "withdraw", args: [to as Address, toUnits(amt)] })}
          >
            Withdraw
          </button>
        </div>
      </div>
      <TxStatus hash={tx.hash} busy={tx.busy} error={tx.error} />
    </Panel>
  );
}

function Queue({ vault, items, now, canCancel, frozen, refetch }: {
  vault: Address; items: QueuedWithdrawal[];
  now: number; canCancel: boolean; frozen: boolean; refetch: () => void;
}) {
  const tx = useTx(useCallback(() => refetch(), [refetch]));
  const list = [...items].reverse();
  return (
    <Panel title="Waiting transfers">
      {list.length === 0 && <p className="text-sm text-muted">Nothing queued.</p>}
      {list.map((w) => {
        const ready = now >= w.unlockAt;
        return (
          <div key={w.id} className="rounded-lg bg-surface-2 border border-line p-3 flex flex-wrap items-center gap-3 justify-between">
            <div className="text-sm">
              <div className="font-semibold">{usd(w.amount)} → <span className="font-mono">{short(w.to)}</span></div>
              <div className="text-xs text-muted">
                {w.status === PENDING ? (ready ? (frozen ? "Unlocked, but the vault is frozen" : "Unlocked, ready to send") : `Unlocks in ${duration(w.unlockAt - now)} (${localTime(w.unlockAt)})`) : STATUS[w.status]}
              </div>
            </div>
            {w.status === PENDING && (
              <div className="flex gap-2">
                {canCancel && (
                  <button className="btn btn-good" disabled={tx.busy} onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "cancel", args: [BigInt(w.id)] })}>
                    Cancel
                  </button>
                )}
                {ready && !frozen && (
                  <button className="btn btn-ghost" disabled={tx.busy} onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "execute", args: [BigInt(w.id)] })}>
                    Send now
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <TxStatus hash={tx.hash} busy={tx.busy} error={tx.error} />
    </Panel>
  );
}

function Emergency({ vault, recovery, refetch, pending }: { vault: Address; recovery: Address; refetch: () => void; pending: number }) {
  const tx = useTx(useCallback(() => refetch(), [refetch]));
  const [hours, setHours] = useState("72");
  return (
    <Panel title={pending ? `Emergency · ${pending} request${pending > 1 ? "s" : ""} waiting` : "Emergency"}>
      <button
        className="btn btn-moon w-full"
        disabled={tx.busy}
        onClick={() => {
          if (confirm(`Send the vault's entire USDC balance to the recovery address ${recovery}?`))
            tx.send({ address: vault, abi: vaultAbi, functionName: "rescue", args: [USDC!] });
        }}
      >
        Rescue everything → {short(recovery)}
      </button>
      <div className="flex gap-2">
        <select className="input" value={hours} onChange={(e) => setHours(e.target.value)}>
          {["1", "12", "24", "72"].map((h) => <option key={h} value={h}>Freeze {h} hours</option>)}
        </select>
        <button className="btn btn-ghost shrink-0" disabled={tx.busy} onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "freeze", args: [Number(hours) * 3600] })}>
          Freeze
        </button>
      </div>
      <p className="text-xs text-muted">Rescue can only send to the recovery address, and it voids everything still queued. A freeze pauses every unlock and can’t be lifted early.</p>
      <TxStatus hash={tx.hash} busy={tx.busy} error={tx.error} />
    </Panel>
  );
}

function People({ owner, recovery, guardians }: { owner: Address; recovery: Address; guardians: readonly Address[] }) {
  const row = (k: string, a: Address) => (
    <div key={k + a} className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{k}</span>
      <a className="font-mono underline" href={`${explorer}/address/${a}`} target="_blank" rel="noreferrer">{short(a)}</a>
    </div>
  );
  return (
    <Panel title="People">
      {row("Owner", owner)}
      {row("Recovery", recovery)}
      {guardians.length === 0 && <p className="text-sm text-bad">No guardians. Add at least one so someone can cancel or rescue.</p>}
      {guardians.map((g, i) => row(`Guardian ${i + 1}`, g))}
    </Panel>
  );
}

function Changes({ vault, items, now, canCancel, frozen, refetch }: {
  vault: Address; items: { id: number; label: string; readyAt: number; status: number }[];
  now: number; canCancel: boolean; frozen: boolean; refetch: () => void;
}) {
  const tx = useTx(useCallback(() => refetch(), [refetch]));
  if (items.length === 0) return null;
  return (
    <Panel title="Rule changes">
      {[...items].reverse().map((c) => {
        const ready = now >= c.readyAt;
        return (
          <div key={c.id} className="rounded-lg bg-surface-2 border border-line p-3 space-y-2">
            <div className="text-sm break-all">{c.label}</div>
            <div className="text-xs text-muted">
              {c.status === PENDING ? (ready ? "Ready to apply" : `Applies in ${duration(c.readyAt - now)}`) : STATUS[c.status] === "Sent" ? "Applied" : STATUS[c.status]}
            </div>
            {c.status === PENDING && (
              <div className="flex gap-2">
                {canCancel && (
                  <button className="btn btn-good" disabled={tx.busy} onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "cancelChange", args: [BigInt(c.id)] })}>
                    Cancel
                  </button>
                )}
                {ready && !frozen && (
                  <button className="btn btn-ghost" disabled={tx.busy} onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "applyChange", args: [BigInt(c.id)] })}>
                    Apply
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <TxStatus hash={tx.hash} busy={tx.busy} error={tx.error} />
    </Panel>
  );
}

function Settings({ vault, rules, guardians, refetch }: {
  vault: Address; rules: { dailyLimit: bigint; delay: number; curfewStart: number; curfewEnd: number }; guardians: readonly Address[]; refetch: () => void;
}) {
  const tx = useTx(useCallback(() => refetch(), [refetch]));
  const [g, setG] = useState("");
  const [limit, setLimit] = useState(String(Number(rules.dailyLimit) / 1e6));
  const [delayH, setDelayH] = useState(String(rules.delay / 3600));
  const [start, setStart] = useState(minToHHMM(utcToLocalMin(rules.curfewStart)));
  const [end, setEnd] = useState(minToHHMM(utcToLocalMin(rules.curfewEnd)));
  const [rec, setRec] = useState("");

  const next = { dailyLimit: toUnits(limit), delay: Math.round(Number(delayH) * 3600), curfewStart: localToUtcMin(hhmmToMin(start)), curfewEnd: localToUtcMin(hhmmToMin(end)) };
  const sameCurfew = next.curfewStart === rules.curfewStart && next.curfewEnd === rules.curfewEnd;
  const onlyLowerLimit = next.dailyLimit < rules.dailyLimit && next.delay === rules.delay && sameCurfew;
  const onlyRaiseDelay = next.delay > rules.delay && next.dailyLimit === rules.dailyLimit && sameCurfew;

  function saveRules() {
    if (onlyLowerLimit) return tx.send({ address: vault, abi: vaultAbi, functionName: "lowerDailyLimit", args: [next.dailyLimit] });
    if (onlyRaiseDelay) return tx.send({ address: vault, abi: vaultAbi, functionName: "raiseDelay", args: [next.delay] });
    return tx.send({ address: vault, abi: vaultAbi, functionName: "proposeRules", args: [next] });
  }

  return (
    <Panel title="Settings">
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">Allowance / day</span><input className="input" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
        <label><span className="label">Delay (hours)</span><input className="input" value={delayH} onChange={(e) => setDelayH(e.target.value)} /></label>
        <label><span className="label">Curfew start</span><input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label><span className="label">Curfew end</span><input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <button className="btn btn-ghost w-full" disabled={tx.busy} onClick={saveRules}>
        {onlyLowerLimit || onlyRaiseDelay ? "Tighten now (instant)" : `Request change (waits ${duration(rules.delay)})`}
      </button>

      <div className="pt-3 border-t border-line space-y-2">
        <span className="label">Add a guardian (instant)</span>
        <div className="flex gap-2">
          <input className="input font-mono" placeholder="0x…" value={g} onChange={(e) => setG(e.target.value.trim())} />
          <button className="btn btn-ghost shrink-0" disabled={tx.busy || !isAddress(g)} onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "addGuardian", args: [g as Address] })}>Add</button>
        </div>
        {guardians.map((x) => (
          <div key={x} className="flex justify-between items-center text-sm">
            <span className="font-mono">{short(x)}</span>
            <button className="text-xs underline text-muted" disabled={tx.busy} onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "proposeRemoveGuardian", args: [x] })}>
              Request removal (waits)
            </button>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-line space-y-2">
        <span className="label">Change recovery address (waits the delay)</span>
        <div className="flex gap-2">
          <input className="input font-mono" placeholder="0x…" value={rec} onChange={(e) => setRec(e.target.value.trim())} />
          <button className="btn btn-ghost shrink-0" disabled={tx.busy || !isAddress(rec)} onClick={() => tx.send({ address: vault, abi: vaultAbi, functionName: "proposeRecovery", args: [rec as Address] })}>Request</button>
        </div>
      </div>
      <TxStatus hash={tx.hash} busy={tx.busy} error={tx.error} />
    </Panel>
  );
}
