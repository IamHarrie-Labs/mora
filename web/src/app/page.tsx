import Link from "next/link";
import { Mark } from "@/components/Logo";
import { ALERT_BOT } from "@/lib/config";
import { LIVE, PROOF_STEPS, basescan } from "@/lib/proof";

const NIGHT = [
  { t: "22:00", h: "Curfew starts", p: "Your instant allowance drops to $0 until morning." },
  { t: "02:07", h: "Someone uses your key", p: "They ask to send $10,000. The vault puts the request in a queue that opens at 14:07." },
  { t: "02:11", h: "Ada’s phone buzzes", p: `Your guardian gets a Telegram message from @${ALERT_BOT ?? "usemora_bot"} with a link to the vault.` },
  { t: "02:14", h: "Ada presses Rescue", p: "The balance moves to your recovery wallet. The queued request is void." },
  { t: "07:00", h: "You wake up", p: "The person with your key has $0. You make a new vault with a new key." },
];

const RULES = [
  ["Instant allowance", "Small amounts leave right away, up to a daily limit you pick. The allowance refills a little at a time over 24 hours, so splitting a transfer across midnight gains nothing."],
  ["Curfew", "During the hours you sleep, the instant allowance is $0. Every transfer waits."],
  ["The queue", "Anything above the allowance waits for the delay you set, 12 hours for example. A wait that would end during curfew ends when curfew does."],
  ["Guardians", "Up to five people you trust. Each one can cancel a queued transfer, freeze the vault for up to three days, or press Rescue. None of them can send money to themselves."],
  ["Rescue", "Sends the whole balance to the recovery address you chose when you made the vault. It also voids every transfer and rule change still in the queue."],
  ["Slow changes", "Raising a limit, removing a guardian, or changing the recovery address waits the same delay, so a guardian can cancel it. Lowering a limit happens at once."],
];

const STATS = [
  { n: "158,000", t: "personal wallets compromised in 2025", s: "Chainalysis" },
  { n: "$713M", t: "taken from those wallets", s: "Chainalysis" },
  { n: "72", t: "verified physical “wrench attacks” in 2025", s: "CertiK" },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-[var(--gutter)] pt-10 pb-20 sm:pt-16 sm:pb-28">
        <div className="halftone absolute -right-24 -top-10 h-[380px] w-[380px] text-[#e6d9b8] sm:right-[8%] sm:top-6" />
        <div className="relative grid items-end gap-12 lg:grid-cols-[1.35fr_1fr]">
          <div className="reveal">
            <span className="eyebrow">A self-custody vault on Base</span>
            <h1 className="h-xl mt-7">
              Nothing big leaves before morning.
            </h1>
            <p className="lede mt-8 max-w-xl text-muted">
              Mora holds the crypto you keep yourself. Large transfers wait in a queue, and people you trust can stop them while
              they wait. If your key leaks at 2 AM, the money is still there at 7.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link href="/demo" className="btn btn-moon btn-lg">Play the 2:07 AM demo</Link>
              <Link href="/app" className="link-arrow">Make a vault →</Link>
            </div>
            <p className="mt-5 text-sm text-muted">The demo runs in your browser. No wallet needed.</p>
          </div>

          <div className="relative mx-auto w-full max-w-[520px] lg:mb-2">
            <div className="rounded-[28px] border-[1.5px] border-black bg-sun px-8 pt-14 pb-0 shadow-[10px_10px_0_#111] sm:px-12">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="num">02:07</span>
                <span className="pill">curfew on</span>
              </div>
              <div className="mt-6 text-sm font-medium">Most anyone can take from this vault right now</div>
              <div className="big-num mt-2 text-[96px] sm:text-[128px]">$0</div>
              <Mark size={440} rising className="mt-8 block w-full text-black" />
            </div>
            <div className="absolute -top-5 left-6 rotate-[-3deg] rounded-full border-[1.5px] border-black bg-paper px-4 py-2 text-sm font-semibold sm:-left-10">
              $10,000 waiting until 14:07
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="marquee" aria-hidden="true">
        {[0, 1].map((k) => (
          <div key={k}>
            <span>Instant allowance</span><span>✺</span><span>Curfew hours</span><span>✺</span><span>A queue for big transfers</span><span>✺</span>
            <span>Guardians</span><span>✺</span><span>Rescue to a wallet you chose</span><span>✺</span><span>Slow rule changes</span><span>✺</span>
          </div>
        ))}
      </div>

      {/* Why */}
      <section className="band band-white">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <span className="eyebrow">Why it exists</span>
            <h2 className="h-lg mt-6">One leaked key empties a wallet in one transaction.</h2>
          </div>
          <div className="lg:pt-14">
            <p className="lede">
              In 2026 Binance, Coinbase and SwissBorg added withdrawal delays and trusted contacts for the money they hold for
              you. Keys you hold yourself had nothing like it. Mora gives them the same delay, and gives the people you trust
              a way to act on it.
            </p>
            <dl className="mt-12 grid gap-8 sm:grid-cols-3">
              {STATS.map((s) => (
                <div key={s.t} className="border-t-[1.5px] border-black pt-4">
                  <dt className="display text-[40px] font-extrabold leading-none tracking-[-0.05em]">{s.n}</dt>
                  <dd className="mt-3 text-sm leading-snug">{s.t}</dd>
                  <dd className="mt-2 text-xs text-muted">{s.s}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* A night with Mora */}
      <section className="band band-sun">
        <div className="halftone absolute -right-24 -bottom-72 h-[460px] w-[460px] text-[#d9a21a]" />
        <div className="relative">
          <span className="eyebrow">A night with Mora</span>
          <h2 className="h-lg mt-6 max-w-3xl">Your key leaks at 2:07 AM. Here is the rest of the night.</h2>
          <ol className="timeline mt-16">
            {NIGHT.map((n, i) => (
              <li key={n.t} className={i === 1 ? "dark" : undefined}>
                <div className="num text-[28px] font-bold">{n.t}</div>
                <h3 className="mt-2 text-xl font-bold">{n.h}</h3>
                <p className="mt-2 text-[15px] leading-relaxed">{n.p}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14">
            <Link href="/demo" className="btn btn-moon btn-lg">Play it yourself</Link>
          </div>
        </div>
      </section>

      {/* Rules */}
      <section id="how" className="band scroll-mt-16">
        <div className="grid gap-12 lg:grid-cols-[300px_1fr]">
          <div className="relative">
            <h2 className="display text-[64px] font-extrabold uppercase leading-[0.85] tracking-[-0.04em] lg:sticky lg:top-28 lg:text-[104px] lg:[writing-mode:vertical-rl] lg:rotate-180">
              Six rules
            </h2>
            <div className="halftone absolute left-28 top-[340px] hidden h-[210px] w-[210px] text-black lg:block" />
          </div>
          <div>
            <p className="lede max-w-2xl">
              You set the rules once, when you make the vault. The contract enforces them for everyone, you included, and loosening
              any of them takes the full delay.
            </p>
            <div className="mt-12">
              {RULES.map(([h, p], i) => (
                <div key={h} className="rule-row">
                  <span className="n">0{i + 1}</span>
                  <div>
                    <h3 className="h-md">{h}</h3>
                    <p className="mt-3 max-w-2xl leading-relaxed text-muted">{p}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Alerts */}
      <section className="band band-white">
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="eyebrow">Guardian alerts</span>
            <h2 className="h-lg mt-6">A delay works when someone is watching.</h2>
            <p className="lede mt-8 max-w-xl">
              Anyone can follow a vault on Telegram. When a transfer or rule change joins the queue, every follower gets a message
              within about five minutes, with a link straight to Cancel and Rescue.
            </p>
            <ol className="mt-10 space-y-4 text-[15px]">
              <li className="flex gap-4"><span className="num font-bold">1</span>Open a vault page and tap Get Telegram alerts.</li>
              <li className="flex gap-4"><span className="num font-bold">2</span>Press Start in the bot. You now follow that vault.</li>
              <li className="flex gap-4"><span className="num font-bold">3</span>Send the same link to each of your guardians.</li>
            </ol>
            {ALERT_BOT && (
              <a className="btn btn-ghost mt-10" href={`https://t.me/${ALERT_BOT}`} target="_blank" rel="noreferrer">
                Open @{ALERT_BOT}
              </a>
            )}
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="tg-phone">
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white px-3 py-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sun"><Mark size={24} /></span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">Mora alerts</div>
                  <div className="text-xs text-muted">bot</div>
                </div>
              </div>
              <div className="tg-bubble">
                {"⚠️ Mora vault 0x4987…4580\nA withdrawal of $1,500.00 to 0xBAD…F00D was requested (#1).\nIt unlocks today at 14:07.\n\nNot you? Open the vault to cancel or rescue before it unlocks:"}
                <div className="tg-button">Open the vault</div>
              </div>
              <div className="tg-bubble mt-2">{"✅ Mora vault 0x4987…4580\nWithdrawal #1 was cancelled by 0xA1b…9c2."}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="band band-black">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="eyebrow text-sun">On-chain proof</span>
            <h2 className="h-lg mt-6">We ran the theft on Base Sepolia.</h2>
            <p className="lede mt-8 max-w-md text-[#cfcfcf]">
              Same contract, real transactions. Open any step on Basescan and check it yourself.
            </p>
            <div className="mt-12">
              <div className="text-sm text-[#a6a6a6]">What the stolen key got</div>
              <div className="big-num mt-2 text-[140px] text-sun">$0</div>
            </div>
          </div>
          <ol className="border-t border-[#333]">
            {PROOF_STEPS.map((s, i) => (
              <li key={s.tx} className="grid grid-cols-[44px_1fr_auto] items-baseline gap-4 border-b border-[#333] py-5">
                <span className="num text-sm text-sun">0{i + 1}</span>
                <span className="text-[15px] leading-snug">{s.text}</span>
                <a className="num whitespace-nowrap text-xs text-[#a6a6a6] underline underline-offset-4 hover:text-sun" href={basescan("tx", s.tx)} target="_blank" rel="noreferrer">
                  tx ↗
                </a>
              </li>
            ))}
            <li className="flex flex-wrap gap-3 pt-8">
              <Link href={`/v/${LIVE.vault}`} className="btn btn-sun">See that vault live</Link>
              <a href="https://github.com/IamHarrie-Labs/mora" target="_blank" rel="noreferrer" className="btn border-[#666] text-[#fbf7ee] hover:bg-[#222]">Read the contract</a>
            </li>
          </ol>
        </div>
      </section>

      {/* Limits */}
      <section className="band">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <span className="eyebrow">Read this first</span>
            <h2 className="h-lg mt-6">What Mora does not do.</h2>
          </div>
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {[
              ["It is unaudited.", "Mora runs on Base Sepolia testnet. Use test money."],
              ["It guards the vault only.", "Your everyday wallet works as it always has."],
              ["Someone has to act.", "If nobody cancels a queued transfer before it unlocks, it goes through. Pick a delay with room to spare."],
              ["A leaked key ends the vault.", "Rescue gets the money home. After that, make a fresh vault with a new key."],
            ].map(([h, p]) => (
              <li key={h} className="border-t-[1.5px] border-black pt-4">
                <h3 className="text-lg font-bold">{h}</h3>
                <p className="mt-2 leading-relaxed text-muted">{p}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing */}
      <section className="band band-sun">
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="h-xl max-w-4xl">Set the rules while you are calm.</h2>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/app" className="btn btn-moon btn-lg">Make your vault</Link>
              <Link href="/demo" className="btn btn-ghost btn-lg">Try the demo first</Link>
            </div>
          </div>
          <Mark size={300} className="shrink-0 text-black" />
        </div>
      </section>
    </div>
  );
}
