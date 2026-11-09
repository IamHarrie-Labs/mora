"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as S from "@/lib/sim";
import { LIVE, PROOF_STEPS, basescan } from "@/lib/proof";

type Scenario = "leak" | "force";

const SCENARIOS: Record<Scenario, { tab: string; title: string; intro: string; attacker: string; attackerSub: string }> = {
  leak: {
    tab: "Your key leaked",
    title: "It’s 2:07 AM. Someone has your key.",
    intro:
      "A phishing site stole your wallet key while you slept. The thief has full owner access to your Mora vault. Play the thief first, then play your guardian.",
    attacker: "Thief",
    attackerSub: "holds your stolen key",
  },
  force: {
    tab: "Phone to your face",
    title: "It’s 2:07 AM. Someone is in your house.",
    intro:
      "They make you unlock your phone and send everything. Every button in the Robber panel is something you are forced to press. Then play your guardian.",
    attacker: "Robber",
    attackerSub: "forcing you to tap",
  },
};

const THIEF = "0xBAD…F00D";

export default function DemoPage() {
  const [scenario, setScenario] = useState<Scenario>("leak");
  const [v, setV] = useState<S.Vault>(() => S.demoVault());
  const [buzz, setBuzz] = useState(0);
  const pendingCount = v.withdrawals.filter((w) => w.status === "pending").length + v.changes.filter((c) => c.status === "pending").length;
  const lastPending = useRef(0);

  useEffect(() => {
    if (pendingCount > lastPending.current) setBuzz((b) => b + 1);
    lastPending.current = pendingCount;
  }, [pendingCount]);

  const reset = (s: Scenario = scenario) => {
    setScenario(s);
    setV(S.demoVault());
    lastPending.current = 0;
  };

  const sc = SCENARIOS[scenario];
  const extractable = S.maxExtractableNow(v);
  const stolen = v.wallets[THIEF] || 0;
  const rescued = v.rescued;
  const nextUnlock = useMemo(() => {
    const times = [...v.withdrawals.filter((w) => w.status === "pending").map((w) => w.unlockAt), ...v.changes.filter((c) => c.status === "pending").map((c) => c.readyAt)];
    return times.length ? Math.min(...times) : null;
  }, [v]);
  const morning = S.demoVault().now - (S.demoVault().now % S.DAY) + 7 * S.HOUR;
  const attackerActed = v.log.some((l) => l.who === "attacker");
  const settled = attackerActed && pendingCount === 0;

  const hint = !attackerActed
    ? `Start in the ${sc.attacker} panel: try to take the money.`
    : pendingCount > 0 && rescued === 0
      ? "Your guardian’s phone just buzzed. In Ada’s panel, cancel the requests or press Rescue."
      : pendingCount > 0
        ? "The money is safe. Cancel the waiting requests too, or the attacker’s rule changes will still go through."
        : !settled
        ? "Now skip ahead and see what the attacker ends up with."
        : "Skip ahead to see what happens once the delays run out.";

  return (
    <div className="wrap">
      <section className="page-head grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <span className="eyebrow">Demo · no wallet needed</span>
          <h1 className="page-title mt-5">{sc.title}</h1>
          <p className="lede mt-5 max-w-2xl text-muted">{sc.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {(Object.keys(SCENARIOS) as Scenario[]).map((k) => (
            <button key={k} onClick={() => reset(k)} className={`btn ${k === scenario ? "btn-moon" : "btn-ghost"}`} aria-pressed={k === scenario}>
              {SCENARIOS[k].tab}
            </button>
          ))}
          <button onClick={() => reset()} className="btn btn-ghost">Restart</button>
        </div>
      </section>

      <div className="overflow-hidden rounded-[22px] border-[1.5px] border-black bg-black text-[#fbf7ee]">
        <div className="grid grid-cols-2 gap-px bg-[#2a2a2a] lg:grid-cols-[1fr_1.4fr_1fr_1fr_1fr]">
          <Stat label="Time" value={S.clock(v.now)} mono />
          <Stat label="Most anyone can take now" value={`$${extractable.toLocaleString()}`} big tone={extractable === 0 ? "sun" : "bad"} />
          <Stat label="In the vault" value={`$${v.balance.toLocaleString()}`} />
          <Stat label="Attacker got" value={`$${stolen.toLocaleString()}`} tone={stolen ? "bad" : undefined} />
          <Stat label="Safe in your cold wallet" value={`$${rescued.toLocaleString()}`} tone={rescued ? "sun" : undefined} wide />
        </div>
        <div className="border-t border-[#2a2a2a] px-5 py-3 text-xs text-[#b3b3b3]">
          Rules: ${v.rules.dailyLimit} instant per day · nothing instant 22:00 to 07:00 · everything else waits 12h · 1 guardian · recovery is your cold wallet
        </div>
      </div>

      <div className="sticky top-[64px] z-20 mt-4 rounded-[16px] border-[1.5px] border-black bg-sun px-4 py-3 text-[15px] sm:static sm:px-5 sm:py-4" role="status">
        <div className="flex items-start gap-3">
          <span className="font-bold">Next</span>
          <span className="min-w-0 flex-1">{hint}</span>
        </div>
        <div className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/20 pt-2 text-xs sm:hidden">
          <span>{S.clock(v.now)}</span>
          <span>can take ${extractable.toLocaleString()}</span>
          <span>attacker ${stolen.toLocaleString()}</span>
          {attackerActed && pendingCount > 0 && <a href="#guardian" className="tap ml-auto -my-3 px-2 font-sans font-semibold underline">Ada’s phone ↓</a>}
          {!attackerActed && <a href="#attacker" className="tap ml-auto -my-3 px-2 font-sans font-semibold underline">{sc.attacker} ↓</a>}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Phone id="attacker" title={sc.attacker} sub={sc.attackerSub} tone="bad">
          <ActionButton onClick={() => setV(S.withdraw(v, THIEF, v.balance || 10_000))}>Send everything to {THIEF}</ActionButton>
          <ActionButton onClick={() => setV(S.withdraw(v, THIEF, 200))}>Send $200, the daily allowance</ActionButton>
          {scenario === "leak" ? (
            <ActionButton onClick={() => setV(S.proposeChange(v, "recovery", `change the recovery address to ${THIEF}`, (s) => void (s.recovery = THIEF)))}>
              Change the recovery address to mine
            </ActionButton>
          ) : (
            <ActionButton
              onClick={() =>
                setV(S.proposeChange(v, "rules", "raise the limit to $10,000 and turn off curfew", (s) => void (s.rules = { dailyLimit: 10_000, delay: S.HOUR, curfewStart: 0, curfewEnd: 0 })))
              }
            >
              Turn off the limits
            </ActionButton>
          )}
          <ActionButton onClick={() => setV(S.proposeChange(v, "removeGuardian", "remove your guardian", () => undefined))}>Remove the guardian</ActionButton>
        </Phone>

        <div className="rounded-[22px] border-[1.5px] border-black bg-surface-2 p-5">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">Vault queue</h2>
            <span className="pill">{pendingCount} waiting</span>
          </div>
          <div className="mt-4 space-y-2">
            {v.withdrawals.length === 0 && v.changes.length === 0 && <p className="text-sm text-muted">Nothing waiting.</p>}
            {v.withdrawals.map((w) => (
              <QueueRow key={`w${w.id}`} status={w.status} title={`Send $${w.amount.toLocaleString()} to ${w.to}`} sub={`unlocks ${S.clock(w.unlockAt)}`} />
            ))}
            {v.changes.map((c) => (
              <QueueRow key={`c${c.id}`} status={c.status} title={`Rule change: ${c.label}`} sub={`applies ${S.clock(c.readyAt)}`} />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            {v.now < morning && <button className="btn btn-ghost" onClick={() => setV(S.advanceTo(v, morning))}>Skip to 07:00</button>}
            {nextUnlock && <button className="btn btn-ghost" onClick={() => setV(S.advanceTo(v, nextUnlock))}>Skip to {S.clock(nextUnlock)}, the first unlock</button>}
          </div>
        </div>

        <Phone id="guardian" title="Ada, your sister" sub="your guardian" tone="good" buzzKey={buzz}>
          {pendingCount === 0 && <p className="text-sm text-muted">No alerts. The phone is quiet.</p>}
          {v.withdrawals.filter((w) => w.status === "pending").map((w) => (
            <Alert key={`aw${w.id}`} text={`Mora: $${w.amount.toLocaleString()} to ${w.to} is waiting. It unlocks at ${S.clock(w.unlockAt)}.`}>
              <button className="btn btn-good" onClick={() => setV(S.cancel(v, w.id))}>Cancel</button>
            </Alert>
          ))}
          {v.changes.filter((c) => c.status === "pending").map((c) => (
            <Alert key={`ac${c.id}`} text={`Mora: someone asked to ${c.label}. It applies at ${S.clock(c.readyAt)}.`}>
              <button className="btn btn-good" onClick={() => setV(S.cancelChange(v, c.id))}>Cancel</button>
            </Alert>
          ))}
          <div className="grid gap-2 border-t border-line pt-3">
            <button className="btn btn-sun" disabled={v.balance === 0} onClick={() => setV(S.rescue(v))}>Rescue everything to your cold wallet</button>
            <button className="btn btn-ghost" onClick={() => setV(S.freeze(v, 3 * S.DAY))}>Freeze for 3 days</button>
            <p className="text-xs leading-relaxed text-muted">A guardian can cancel, freeze or rescue. Rescue sends money only to your recovery address, and it voids everything in the queue.</p>
          </div>
        </Phone>
      </div>

      {settled && v.now > S.demoVault().now && (
        <div className={`mt-6 rounded-[22px] border-[1.5px] border-black p-8 text-center ${stolen ? "bg-white" : "bg-sun"}`}>
          <div className="page-title">{stolen ? `The attacker got $${stolen.toLocaleString()}.` : "The attacker got $0."}</div>
          <p className="mt-3 text-muted">
            {stolen ? "Try again. The guardian has 12 hours to cancel or rescue." : rescued ? `Your $${rescued.toLocaleString()} is in your cold wallet.` : `Your $${v.balance.toLocaleString()} is still in the vault.`}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className="btn btn-ghost" onClick={() => reset(scenario === "leak" ? "force" : "leak")}>Try “{SCENARIOS[scenario === "leak" ? "force" : "leak"].tab}”</button>
            <Link href="/app" className="btn btn-moon">Make your own vault</Link>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-[22px] border border-line bg-white p-6">
        <h2 className="panel-title">What happened</h2>
        <ol className="mt-4 space-y-2 text-sm">
          {v.log.map((l, i) => (
            <li key={i} className="flex gap-4">
              <span className="num shrink-0 text-muted">{S.clock(l.t)}</span>
              <span className={l.tone === "bad" ? "text-bad" : l.tone === "good" ? "text-good" : "text-ink"}>
                <span className="font-semibold">{l.who === "attacker" ? sc.attacker : l.who === "guardian" ? "Guardian" : "Vault"}: </span>
                {l.text}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-muted">
          This simulation follows the same rules as the MoraVault contract. 30 parity tests check it against the real contract step by step.{" "}
          <a className="tap underline" href="#live-proof">See the attack on-chain ↓</a>
        </p>
      </div>

      <LiveProof />
    </div>
  );
}

function Stat({ label, value, big, mono, tone, wide }: { label: string; value: string; big?: boolean; mono?: boolean; tone?: "sun" | "bad"; wide?: boolean }) {
  const color = tone === "sun" ? "text-sun" : tone === "bad" ? "text-[#ff8a73]" : "";
  return (
    <div className={`bg-black px-4 py-4 sm:px-5 sm:py-5 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#a6a6a6]">{label}</div>
      <div className={`mt-2 ${mono ? "num text-[26px] font-bold sm:text-[34px]" : big ? "big-num text-[40px] sm:text-[52px]" : "big-num text-[26px] sm:text-[30px]"} ${color}`}>{value}</div>
    </div>
  );
}

function LiveProof() {
  return (
    <section id="live-proof" className="mt-6 scroll-mt-24 rounded-[22px] bg-black p-6 text-[#fbf7ee] sm:p-8">
      <span className="eyebrow text-sun">On-chain proof</span>
      <h2 className="h-md mt-4">This attack ran on Base Sepolia, with the same contract.</h2>
      <ol className="mt-6 border-t border-[#333]">
        {PROOF_STEPS.map((s, i) => (
          <li key={s.tx} className="grid grid-cols-[40px_1fr_auto] items-baseline gap-3 border-b border-[#333] py-3 text-sm">
            <span className="num text-sun">0{i + 1}</span>
            <span>{s.text}</span>
            <a className="tap num whitespace-nowrap text-xs text-[#a6a6a6] underline underline-offset-4 hover:text-sun" href={basescan("tx", s.tx)} target="_blank" rel="noreferrer">tx ↗</a>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/v/${LIVE.vault}`} className="btn btn-sun">See that vault live</Link>
        <a href={basescan("address", LIVE.factory)} target="_blank" rel="noreferrer" className="btn border-[#666] text-[#fbf7ee] hover:bg-[#222]">Factory on Basescan ↗</a>
      </div>
    </section>
  );
}

function Phone({ id, title, sub, tone, children, buzzKey }: { id?: string; title: string; sub: string; tone: "bad" | "good"; children: React.ReactNode; buzzKey?: number }) {
  return (
    <div id={id} key={buzzKey} className={`scroll-mt-60 sm:scroll-mt-24 rounded-[22px] border-[1.5px] border-black bg-white p-5 shadow-[6px_6px_0_#111] ${buzzKey ? "buzz" : ""}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${tone === "bad" ? "bg-[#ffd9d0] text-bad" : "bg-[#d6f0e2] text-good"}`}>{title[0]}</span>
        <div>
          <div className="panel-title leading-tight">{title}</div>
          <div className="text-xs text-muted">{sub}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">{children}</div>
    </div>
  );
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="btn btn-ghost justify-start rounded-[14px] text-left" onClick={onClick}>
      {children}
    </button>
  );
}

function Alert({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-[14px] bg-surface-2 p-3">
      <p className="text-sm">{text}</p>
      {children}
    </div>
  );
}

function QueueRow({ status, title, sub }: { status: S.Status; title: string; sub: string }) {
  const tag = status === "pending" ? ["waiting", "pill-sun"] : status === "cancelled" ? ["stopped", "text-good border-good"] : ["sent", "text-bad border-bad"];
  return (
    <div className="flex items-start justify-between gap-3 rounded-[14px] bg-white p-3 text-sm">
      <div>
        <div className={status === "cancelled" ? "text-muted line-through" : "font-medium"}>{title}</div>
        <div className="num mt-0.5 text-xs text-muted">{sub}</div>
      </div>
      <span className={`pill shrink-0 ${tag[1]}`}>{tag[0]}</span>
    </div>
  );
}
