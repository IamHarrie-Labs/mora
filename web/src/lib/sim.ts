/**
 * In-browser simulation of MoraVault for the no-wallet demo.
 * It follows the same rules as contracts/MoraVault.sol, function by function,
 * so judges can try the attack scenarios without a wallet or test ETH.
 * Amounts are in dollars; times are unix seconds (UTC).
 */
export const DAY = 86400;
export const HOUR = 3600;

export type Rules = { dailyLimit: number; delay: number; curfewStart: number; curfewEnd: number };
export type Status = "pending" | "executed" | "cancelled";
export type Withdrawal = { id: number; to: string; amount: number; unlockAt: number; status: Status; by: string };
export type ChangeKind = "rules" | "recovery" | "removeGuardian";
export type Change = { id: number; kind: ChangeKind; label: string; readyAt: number; status: Status; apply: (s: Vault) => void };
export type LogEntry = { t: number; who: "attacker" | "guardian" | "vault" | "owner"; text: string; tone?: "bad" | "good" | "info" };

export type Vault = {
  now: number;
  balance: number;
  used: number;
  usedAt: number;
  rules: Rules;
  frozenUntil: number;
  recovery: string;
  /** Total ever rescued to the original recovery wallet. */
  rescued: number;
  wallets: Record<string, number>;
  withdrawals: Withdrawal[];
  changes: Change[];
  log: LogEntry[];
};

export function inCurfew(r: Rules, ts: number) {
  if (r.curfewStart === r.curfewEnd) return false;
  const m = Math.floor((ts % DAY) / 60);
  return r.curfewStart < r.curfewEnd ? m >= r.curfewStart && m < r.curfewEnd : m >= r.curfewStart || m < r.curfewEnd;
}

function curfewEndAfter(r: Rules, ts: number) {
  let end = ts - (ts % DAY) + r.curfewEnd * 60;
  if (end <= ts) end += DAY;
  return end;
}

export function unlockTime(r: Rules, ts: number) {
  let t = ts + r.delay;
  if (inCurfew(r, t)) t = curfewEndAfter(r, t);
  return t;
}

const isFrozen = (v: Vault) => v.now < v.frozenUntil;

function currentUsed(v: Vault) {
  const refill = ((v.now - v.usedAt) * v.rules.dailyLimit) / DAY;
  return v.used > refill ? v.used - refill : 0;
}

export function maxExtractableNow(v: Vault) {
  if (isFrozen(v) || inCurfew(v.rules, v.now)) return 0;
  const left = Math.max(0, v.rules.dailyLimit - currentUsed(v));
  return Math.min(left, v.balance);
}

const clone = (v: Vault): Vault => ({
  ...v,
  rules: { ...v.rules },
  wallets: { ...v.wallets },
  withdrawals: v.withdrawals.map((w) => ({ ...w })),
  changes: v.changes.map((c) => ({ ...c })),
  log: [...v.log],
});

const log = (v: Vault, who: LogEntry["who"], text: string, tone?: LogEntry["tone"]) =>
  v.log.push({ t: v.now, who, text, tone });

/** Owner key (yours, or a thief's) asks to send `amount` to `to`. */
export function withdraw(prev: Vault, to: string, amount: number, by: LogEntry["who"] = "attacker"): Vault {
  const v = clone(prev);
  const u = currentUsed(v);
  const instant = !isFrozen(v) && !inCurfew(v.rules, v.now) && u + amount <= v.rules.dailyLimit && amount <= v.balance;
  if (instant) {
    v.used = u + amount;
    v.usedAt = v.now;
    v.balance -= amount;
    v.wallets[to] = (v.wallets[to] || 0) + amount;
    log(v, by, `Sent $${amount.toLocaleString()} to ${to} instantly (within the allowance).`, by === "attacker" ? "bad" : "info");
    return v;
  }
  const w: Withdrawal = { id: v.withdrawals.length, to, amount, unlockAt: unlockTime(v.rules, v.now), status: "pending", by };
  v.withdrawals.push(w);
  log(v, by, `Tried to send $${amount.toLocaleString()} to ${to}.`, by === "attacker" ? "bad" : "info");
  log(v, "vault", `Queued. It cannot leave before ${clock(w.unlockAt)}. Guardians alerted.`, "info");
  return v;
}

export function cancel(prev: Vault, id: number): Vault {
  const v = clone(prev);
  const w = v.withdrawals[id];
  if (!w || w.status !== "pending") return prev;
  w.status = "cancelled";
  log(v, "guardian", `Cancelled the $${w.amount.toLocaleString()} transfer to ${w.to}.`, "good");
  return v;
}

export function execute(prev: Vault, id: number): Vault {
  const v = clone(prev);
  const w = v.withdrawals[id];
  if (!w || w.status !== "pending" || v.now < w.unlockAt || isFrozen(v)) return prev;
  if (w.amount > v.balance) {
    log(v, "vault", `The $${w.amount.toLocaleString()} transfer to ${w.to} failed: the vault is empty.`, "good");
    w.status = "cancelled";
    return v;
  }
  w.status = "executed";
  v.balance -= w.amount;
  v.wallets[w.to] = (v.wallets[w.to] || 0) + w.amount;
  log(v, "vault", `Released $${w.amount.toLocaleString()} to ${w.to} after the delay.`, w.by === "attacker" ? "bad" : "info");
  return v;
}

export function freeze(prev: Vault, secs: number): Vault {
  const v = clone(prev);
  v.frozenUntil = Math.max(v.frozenUntil, v.now + secs);
  log(v, "guardian", `Froze the vault until ${clock(v.frozenUntil)}.`, "good");
  return v;
}

export function rescue(prev: Vault): Vault {
  if (prev.balance === 0) return prev;
  const v = clone(prev);
  const amt = v.balance;
  v.wallets[v.recovery] = (v.wallets[v.recovery] || 0) + amt;
  v.balance = 0;
  v.rescued += amt;
  log(v, "guardian", `Rescued $${amt.toLocaleString()} to ${v.recovery}. It can go nowhere else.`, "good");
  return v;
}

export function proposeChange(prev: Vault, kind: ChangeKind, label: string, apply: (s: Vault) => void, by: LogEntry["who"] = "attacker"): Vault {
  const v = clone(prev);
  const c: Change = { id: v.changes.length, kind, label, readyAt: v.now + v.rules.delay, status: "pending", apply };
  v.changes.push(c);
  log(v, by, `Tried to ${label}.`, by === "attacker" ? "bad" : "info");
  log(v, "vault", `Rule change queued until ${clock(c.readyAt)}. Guardians alerted.`, "info");
  return v;
}

export function cancelChange(prev: Vault, id: number): Vault {
  const v = clone(prev);
  const c = v.changes[id];
  if (!c || c.status !== "pending") return prev;
  c.status = "cancelled";
  log(v, "guardian", `Cancelled the request to ${c.label}.`, "good");
  return v;
}

/** Move time forward, then let anyone execute whatever has unlocked (as a keeper would). */
export function advanceTo(prev: Vault, ts: number): Vault {
  let v = clone(prev);
  v.now = ts;
  log(v, "vault", `Time passes… it is now ${clock(ts)}.`, "info");
  for (const w of v.withdrawals) if (w.status === "pending" && v.now >= w.unlockAt && !isFrozen(v)) v = execute(v, w.id);
  for (const c of v.changes) {
    if (c.status === "pending" && v.now >= c.readyAt && !isFrozen(v)) {
      c.status = "executed";
      c.apply(v);
      log(v, "vault", `Rule change applied: ${c.label}.`, "bad");
    }
  }
  return v;
}

export const clock = (ts: number) => {
  const m = Math.floor((ts % DAY) / 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** The demo vault: $10,000 inside, $200/day instant, curfew 22:00–07:00, 12h delay. Clock starts at 02:07. */
export function demoVault(): Vault {
  const day = 20_000 * DAY; // an arbitrary UTC midnight; only the time of day matters
  const now = day + 2 * HOUR + 7 * 60;
  return {
    now,
    balance: 10_000,
    used: 0,
    usedAt: now - DAY,
    rules: { dailyLimit: 200, delay: 12 * HOUR, curfewStart: 22 * 60, curfewEnd: 7 * 60 },
    frozenUntil: 0,
    recovery: "your cold wallet",
    rescued: 0,
    wallets: {},
    withdrawals: [],
    changes: [],
    log: [{ t: now, who: "vault", text: "02:07 AM. Your vault holds $10,000. Instant allowance at night: $0.", tone: "info" }],
  };
}
