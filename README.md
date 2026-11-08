# Mora

**A time-delay safe for your self-custody crypto, on Base.**
If your key leaks, or someone forces your hand at 2 AM, nothing big leaves before morning, and your guardians can send it all home.

*Mora* is Latin for **delay**. Delay is what keeps the money safe.

Built for **Vibestarter Vibeathon 02** (theme: *Night shift*).

---

## The problem

- **Stolen keys.** In 2025, Chainalysis counted about 158,000 personal-wallet compromises, hitting at least 80,000 victims and costing about $713M. Once a key leaks, a normal wallet can be emptied in one transaction.
- **Physical coercion ("wrench attacks").** CertiK counted 72 verified incidents in 2025 and 52 in the first half of 2026, with reported home invasions rising from 1 to 20.
- **Exchanges already added a delay, but only for money they hold.** Binance, SwissBorg and Coinbase launched withdrawal delays and trusted contacts in 2026. If you hold your own keys on Base, there's no equivalent with simple consumer UX.

## How Mora works

| | |
|---|---|
| **Instant allowance** | Small amounts (e.g. $200) leave immediately. The allowance refills gradually over 24h, so it can't be doubled by timing two withdrawals either side of a reset. |
| **Curfew hours** | During your night (e.g. 22:00–07:00) the instant allowance is **$0**. |
| **Everything else waits** | Larger withdrawals are queued for the full delay (e.g. 12h), even when requested at 06:59. A wait that would end inside curfew is pushed to the end of curfew. |
| **Guardians** | Up to 5 people you trust. They can **cancel** a queued withdrawal, **freeze** the vault (up to 3 days, freezes only extend), or **rescue**. They can never withdraw. |
| **Rescue** | Sends the entire balance to a **recovery address you committed in advance**, and nowhere else. It also **voids everything still queued**, so a thief can't leave a recovery-address or owner change ticking behind it. |
| **Loosening waits too** | Raising limits, removing a guardian, or changing the recovery address or owner is queued behind the same delay and can be cancelled. Tightening is instant. |
| **"Sign on the door"** | `maxExtractableNow()` shows publicly the most anyone can take right now, usually **$0** at night. |

### What happens in an attack
| Scenario | Outcome |
|---|---|
| Key stolen, used at 2:07 AM | Every transfer is queued. A guardian presses Rescue: funds go to your recovery wallet and the thief's queued transfers and rule changes are voided. **Thief gets $0.** |
| Key stolen, used in daytime | At most the remaining instant allowance leaves. Everything else is cancelled or rescued. |
| Forced at home to send everything and loosen the rules | The transfer and the rule changes are all queued, and a guardian cancels them. |
| A guardian turns malicious | They can delay or rescue to *your* recovery address, but never take funds. |
| Thief adds themselves as a guardian | Gains nothing: rescue still only goes to your recovery address. |

## Design: deliberately small

`MoraVault` is a standalone contract that holds the funds itself. It is not a module bolted onto a wallet, so the wallet's owners or other modules have no side door around the delay. Tokens leave only three ways: an instant withdrawal within the allowance, a queued withdrawal after its delay, or a rescue to the recovery address.

There is **no** arbitrary-call function, **no** `approve`, **no** `delegatecall`, **no** upgrade path, and **no** native ETH. `MoraFactory` deploys one EIP-1167 clone per user, and clones point at one fixed implementation forever.

## Run it

```bash
npm install
npx hardhat test
```

All 35 tests cover setup, the allowance (including split and burst bypass attempts), curfew across midnight, minimum delays, cancel, freeze, rescue (including voiding the queue), delayed rule changes, and the full attack scenarios above.

The project compiles with the npm-bundled `solc` 0.8.28 (solc-js), so no compiler download is needed.

### Deploy to Base Sepolia
Use a throwaway test wallet funded from a Base Sepolia faucet:
```bash
DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network baseSepolia
```
This deploys a test USDC (`MockUSDC`) and the factory. Set `USDC_ADDRESS` to use an existing token instead.

## Honest limits

- **Unaudited.** Testnet only for now.
- **Only funds inside the vault are protected.** Your everyday wallet works as before.
- **A delay creates an intervention window. It doesn't guarantee safety.** It can't stop a captor who holds you longer than the delay. That's why guardians, freeze and rescue exist.
- **Curfew hours are set in UTC.** The app converts to your local time.
- **Guardians must be people you trust to respond.** A guardian can cause inconvenience, by freezing or rescuing to your own recovery address, but can't steal.

## Web app

`web/` holds the Next.js app: the no-wallet **2:07 AM demo**, vault creation with a Base Account passkey, an owner and guardian dashboard, and a public page showing the most anyone can take right now. See [web/README.md](web/README.md).

## Roadmap

- Guardian alerts by Telegram with one-tap cancel.
- Founder vaults for teams receiving Vibestarter tranches.
- An agent wallet mode: an AI agent spends small amounts instantly and anything large waits for your morning approval.

## Prior art

Argent's daily limits and guardians, Safe's Zodiac Delay module, and the 2026 exchange withdrawal locks all shaped this design. What Mora adds is rescue to a pre-committed address, curfew hours, delayed loosening of every control, and a public extractable-now check, as a standalone vault on Base.

## License

MIT
