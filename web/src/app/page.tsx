import Link from "next/link";

const STATS = [
  { n: "158,000", t: "personal wallets compromised in 2025", s: "Chainalysis" },
  { n: "$713M", t: "taken from individuals’ wallets in 2025", s: "Chainalysis" },
  { n: "1 → 20", t: "crypto home invasions, H1 2025 vs H1 2026", s: "CertiK" },
];

const RULES = [
  ["Small amounts, instantly", "Spend up to your daily allowance (say $200) right away. It refills gradually over 24 hours."],
  ["Nothing instant at night", "During your curfew hours the instant allowance is $0."],
  ["Everything else waits", "Bigger transfers wait the full delay, say 12 hours, and never unlock during curfew."],
  ["Guardians can stop it", "People you trust get a Telegram alert and can cancel, freeze, or rescue. They can never withdraw."],
  ["Rescue only goes home", "Rescue sends everything to the recovery address you set up in advance, and nowhere else."],
  ["Loosening waits too", "Raising limits, removing a guardian or changing the recovery address waits the same delay. Tightening is instant."],
];

export default function Home() {
  return (
    <div className="space-y-20 pt-10 sm:pt-16">
      <section className="max-w-3xl space-y-6">
        <p className="text-moon font-semibold tracking-wide text-sm uppercase">A time-delay safe for your crypto, on Base</p>
        <h1 className="text-4xl sm:text-6xl font-bold leading-tight">
          While you sleep,
          <br />
          nothing big leaves.
        </h1>
        <p className="text-lg text-muted">
          If your key leaks, or someone forces your hand at 2 AM, Mora holds every large transfer until morning, and your guardians can
          cancel it or send it all home.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/demo" className="btn btn-moon text-base px-5 py-3">Try the 2:07 AM demo, no wallet</Link>
          <Link href="/app" className="btn btn-ghost text-base px-5 py-3">Create a vault</Link>
        </div>
        <p className="text-sm text-muted">
          <em>Mora</em> is Latin for <em>delay</em>. Delay is what keeps the money safe.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.t} className="card p-5">
            <div className="text-3xl font-bold text-moon">{s.n}</div>
            <div className="mt-1">{s.t}</div>
            <div className="text-xs text-muted mt-2">Source: {s.s}</div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Exchanges already added a delay. Self-custody didn’t.</h2>
        <p className="text-muted max-w-3xl">
          In 2026 Binance, SwissBorg and Coinbase all launched withdrawal delays and trusted contacts to fight stolen accounts and
          coercion, but only for money they hold for you. If you hold your own keys, one leaked key or one bad night still empties
          your wallet in a single transaction. Mora brings the same protection to your own wallet.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map(([t, d], i) => (
            <div key={t} className="card p-5">
              <div className="text-moon font-mono text-sm">0{i + 1}</div>
              <div className="font-semibold mt-1">{t}</div>
              <p className="text-sm text-muted mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6 sm:p-8 space-y-4">
        <h2 className="text-2xl font-bold">Small on purpose</h2>
        <p className="text-muted max-w-3xl">
          Your vault is a standalone contract that holds the funds itself, so there’s no side door around the delay. Money leaves only
          three ways: within the instant allowance, after the delay, or by rescue to your own recovery address. It has no
          arbitrary calls, no approvals, no upgrades. 35 tests cover stolen keys, coercion, malicious guardians, and attempts to split
          transfers or time them around the allowance, and 30 more check that the demo follows the contract step for step.
        </p>
        <p className="text-sm text-muted">
          Honest limits: unaudited, testnet only. A delay creates a window for your guardians to act. It doesn’t guarantee safety.
          Only funds inside the vault are protected.
        </p>
        <div className="flex flex-wrap gap-3">
          <a className="btn btn-ghost" href="https://github.com/iamharrie-labs/mora">Read the contract</a>
          <Link className="btn btn-moon" href="/demo">See it stop a theft</Link>
        </div>
      </section>
    </div>
  );
}
