"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as S from "@/lib/sim";

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
    <div className="py-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SCENARIOS) as Scenario[]).map((k) => (
          <button key={k} onClick={() => reset(k)} className={`btn ${k === scenario ? "btn-moon" : "btn-ghost"}`}>
            {SCENARIOS[k].tab}
          </button>
        ))}
        <button onClick={() => reset()} className="btn btn-ghost ml-auto">Restart</button>
      </div>

      <section className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">{sc.title}</h1>
        <p className="text-muted max-w-3xl">{sc.intro}</p>
        <p className="text-xs text-muted">
          Simulation that follows the same rules as the MoraVault contract (tested in{" "}
          <a className="underline" href="https://github.com/iamharrie-labs/mora/blob/main/test/Mora.test.js">test/Mora.test.js</a>). No wallet needed.
        </p>
      </section>

      <div className="card p-4 sm:p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <div className="text-xs text-muted">Time</div>
          <div className="text-3xl font-mono font-bold">{S.clock(v.now)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Most anyone can take right now</div>
          <div className={`text-3xl font-bold ${extractable === 0 ? "text-good" : "text-moon"}`}>${extractable.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-muted">In the vault</div>
          <div className="text-xl font-semibold">${v.balance.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Attacker got</div>
          <div className={`text-xl font-semibold ${stolen ? "text-bad" : "text-good"}`}>${stolen.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Safe in your cold wallet</div>
          <div className="text-xl font-semibold text-good">${rescued.toLocaleString()}</div>
        </div>
        <div className="text-sm text-muted basis-full">
          Rules: ${v.rules.dailyLimit} instant per day · nothing instant 22:00–07:00 · everything else waits 12h · 1 guardian · recovery = your cold wallet
        </div>
      </div>

      <div className="rounded-xl border border-moon/40 bg-moon/10 px-4 py-3 text-sm">
        <span className="font-semibold text-moon">Next: </span>
        {hint}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Attacker */}
        <Phone title={sc.attacker} sub={sc.attackerSub} tone="bad">
          <ActionButton onClick={() => setV(S.withdraw(v, THIEF, v.balance || 10_000))}>Send everything to {THIEF}</ActionButton>
          <ActionButton onClick={() => setV(S.withdraw(v, THIEF, 200))}>Just send $200 (the daily allowance)</ActionButton>
          {scenario === "leak" ? (
            <ActionButton
              onClick={() =>
                setV(S.proposeChange(v, "recovery", `change the recovery address to ${THIEF}`, (s) => void (s.recovery = THIEF)))
              }
            >
              Change the recovery address to mine
            </ActionButton>
          ) : (
            <ActionButton
              onClick={() =>
                setV(
                  S.proposeChange(v, "rules", "raise the limit to $10,000 and turn off curfew", (s) =>
                    void (s.rules = { dailyLimit: 10_000, delay: S.HOUR, curfewStart: 0, curfewEnd: 0 })
                  )
                )
              }
            >
              Turn off the limits
            </ActionButton>
          )}
          <ActionButton
            onClick={() => setV(S.proposeChange(v, "removeGuardian", "remove your guardian", () => undefined))}
          >
            Remove the guardian
          </ActionButton>
        </Phone>

        {/* Vault */}
        <div className="card p-4 space-y-3">
          <div className="font-semibold">Vault queue</div>
          {v.withdrawals.length === 0 && v.changes.length === 0 && <p className="text-sm text-muted">Nothing waiting.</p>}
          {v.withdrawals.map((w) => (
            <QueueRow key={`w${w.id}`} status={w.status} title={`Send $${w.amount.toLocaleString()} → ${w.to}`} sub={`unlocks ${S.clock(w.unlockAt)}`} />
          ))}
          {v.changes.map((c) => (
            <QueueRow key={`c${c.id}`} status={c.status} title={`Rule change: ${c.label}`} sub={`applies ${S.clock(c.readyAt)}`} />
          ))}
          <div className="pt-2 border-t border-line flex flex-wrap gap-2">
            {v.now < morning && (
              <button className="btn btn-ghost" onClick={() => setV(S.advanceTo(v, morning))}>Skip to morning (07:00)</button>
            )}
            {nextUnlock && (
              <button className="btn btn-ghost" onClick={() => setV(S.advanceTo(v, nextUnlock))}>
                Skip to {S.clock(nextUnlock)} (first unlock)
              </button>
            )}
          </div>
        </div>

        {/* Guardian */}
        <Phone title="Ada, your sister" sub="guardian" tone="good" buzzKey={buzz}>
          {pendingCount === 0 && <p className="text-sm text-muted">No alerts. Phone is quiet.</p>}
          {v.withdrawals
            .filter((w) => w.status === "pending")
            .map((w) => (
              <Alert key={`aw${w.id}`} text={`Mora: $${w.amount.toLocaleString()} to ${w.to} is waiting (unlocks ${S.clock(w.unlockAt)}).`}>
                <button className="btn btn-good" onClick={() => setV(S.cancel(v, w.id))}>Cancel</button>
              </Alert>
            ))}
          {v.changes
            .filter((c) => c.status === "pending")
            .map((c) => (
              <Alert key={`ac${c.id}`} text={`Mora: someone asked to ${c.label} (applies ${S.clock(c.readyAt)}).`}>
                <button className="btn btn-good" onClick={() => setV(S.cancelChange(v, c.id))}>Cancel</button>
              </Alert>
            ))}
          <div className="pt-2 border-t border-line grid gap-2">
            <button className="btn btn-moon" disabled={v.balance === 0} onClick={() => setV(S.rescue(v))}>
              Rescue everything → your cold wallet
            </button>
            <button className="btn btn-ghost" onClick={() => setV(S.freeze(v, 3 * S.DAY))}>Freeze 3 days</button>
            <p className="text-xs text-muted">Guardians can cancel, freeze or rescue. They can never withdraw. Rescue only goes to your recovery address and voids everything queued.</p>
          </div>
        </Phone>
      </div>

      {settled && v.now > S.demoVault().now && (
        <div className={`card p-5 text-center ${stolen ? "border-bad" : "border-good"}`}>
          <div className="text-2xl font-bold">{stolen ? `The attacker got $${stolen.toLocaleString()}.` : "The attacker got $0."}</div>
          <p className="text-muted mt-1">
            {stolen
              ? "Try again: the guardian has 12 hours to cancel or rescue."
              : rescued
                ? `Your $${rescued.toLocaleString()} is in your cold wallet.`
                : `Your $${v.balance.toLocaleString()} is still in the vault.`}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button className="btn btn-ghost" onClick={() => reset(scenario === "leak" ? "force" : "leak")}>
              Try “{SCENARIOS[scenario === "leak" ? "force" : "leak"].tab}”
            </button>
            <Link href="/app" className="btn btn-moon">Make your own vault</Link>
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="font-semibold mb-2">What happened</div>
        <ol className="space-y-1.5 text-sm">
          {v.log.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-muted shrink-0">{S.clock(l.t)}</span>
              <span className={l.tone === "bad" ? "text-bad" : l.tone === "good" ? "text-good" : "text-ink"}>
                <span className="text-muted">{l.who === "attacker" ? sc.attacker : l.who === "guardian" ? "Guardian" : "Vault"}: </span>
                {l.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Phone({ title, sub, tone, children, buzzKey }: { title: string; sub: string; tone: "bad" | "good"; children: React.ReactNode; buzzKey?: number }) {
  return (
    <div key={buzzKey} className={`card p-4 space-y-3 ${buzzKey ? "buzz" : ""} ${tone === "bad" ? "border-bad/50" : "border-good/50"}`}>
      <div>
        <div className={`font-semibold ${tone === "bad" ? "text-bad" : "text-good"}`}>{title}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="btn btn-ghost justify-start text-left" onClick={onClick}>
      {children}
    </button>
  );
}

function Alert({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 border border-line p-3 space-y-2">
      <p className="text-sm">{text}</p>
      {children}
    </div>
  );
}

function QueueRow({ status, title, sub }: { status: S.Status; title: string; sub: string }) {
  const tag = status === "pending" ? ["waiting", "text-moon"] : status === "cancelled" ? ["stopped", "text-good"] : ["done", "text-bad"];
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div>
        <div className={status === "cancelled" ? "line-through text-muted" : ""}>{title}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      <span className={`text-xs font-semibold uppercase ${tag[1]}`}>{tag[0]}</span>
    </div>
  );
}
