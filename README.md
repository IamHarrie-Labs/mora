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
| **Guardian alerts** | Guardians tap one link to get a **Telegram message** within about 5 minutes of any withdrawal request or rule change, with a button straight to Cancel and Rescue. Runs on GitHub Actions, no server needed. See [alerts/README.md](alerts/README.md). |

### What happens in an attack
| Scenario | Outcome |
|---|---|
| Key stolen, used at 2:07 AM | Every transfer is queued. A guardian presses Rescue: funds go to your recovery wallet and the thief's queued transfers and rule changes are voided. **Thief gets $0.** |
| Key stolen, used in daytime | At most the remaining instant allowance leaves. Everything else is cancelled or rescued. |
| Forced at home to send everything and loosen the rules | The transfer and the rule changes are all queued, and a guardian cancels them. |
| A guardian turns malicious | They can delay or rescue to *your* recovery address, but never take funds. |
| Thief adds themselves as a guardian | Gains nothing: rescue still only goes to your recovery address. |

## Live on Base Sepolia

| Contract | Address |
|---|---|
| `MoraFactory` | [0x967cd50D421d497EF2D1753635bDC30F3Acd514B](https://sepolia.basescan.org/address/0x967cd50D421d497EF2D1753635bDC30F3Acd514B) |
| `MoraVault` (implementation) | [0x9602447cAaC26C34E9ee0B41a6316032268724ED](https://sepolia.basescan.org/address/0x9602447cAaC26C34E9ee0B41a6316032268724ED) |
| `MockUSDC` (test token, anyone can mint) | [0x15675CcFBa9E7Ca64fFe64cDD4D8DBc75e219636](https://sepolia.basescan.org/address/0x15675CcFBa9E7Ca64fFe64cDD4D8DBc75e219636) |

**Source verified (exact match) on Sourcify:** read it on Blockscout:
[MoraFactory](https://base-sepolia.blockscout.com/address/0x967cd50D421d497EF2D1753635bDC30F3Acd514B?tab=contract) ·
[MoraVault](https://base-sepolia.blockscout.com/address/0x9602447cAaC26C34E9ee0B41a6316032268724ED?tab=contract) ·
[MockUSDC](https://base-sepolia.blockscout.com/address/0x15675CcFBa9E7Ca64fFe64cDD4D8DBc75e219636?tab=contract)
(or on [Sourcify](https://repo.sourcify.dev/84532/0x967cd50D421d497EF2D1753635bDC30F3Acd514B)). Every vault is an EIP-1167 clone of that one `MoraVault`.

**The stolen-key attack, run for real** against vault [0x4987…4580](https://sepolia.basescan.org/address/0x49879021E8C90B25514F3ba03F15a82eb7C44580):

1. [Vault created](https://sepolia.basescan.org/tx/0x9c8ad6a2380b0b7295e10a25948369a1d46553d37e6cef917c4161e04eddd2b8): $200/day instant, 1h delay, 1 guardian, recovery wallet set.
2. [$10,000 test USDC deposited](https://sepolia.basescan.org/tx/0x3ec5fc2ddf6bf2b89dd1e741b559e14ec00bd6d751c0dae99cc2d9f78ed38419).
3. [$50 sent instantly](https://sepolia.basescan.org/tx/0xa5c67f7cec592ee31afa03128afc7ae0e20f7fff22a92d6434b774a1b3f1fd66), inside the allowance.
4. The stolen key tries to [send $5,000](https://sepolia.basescan.org/tx/0x8db72ec54dc11ba872520a22e0127b3e44dc64397418ed878f4618e8309c254d) and [change the recovery address](https://sepolia.basescan.org/tx/0xcab1125591bdee4f063246586838b53a66f76563a5b334a5fd6039213ad9e047). Both are queued.
5. [The guardian presses Rescue](https://sepolia.basescan.org/tx/0xbeea5b9b4c6ca60d6e1e19d36ee658a60ae430a846de2140b128bb81bd5f4dfe): $9,950 goes to the recovery wallet and both requests are voided. `execute` and `applyChange` now revert with `NotPending`. **The thief got $0.**

## Design: deliberately small

`MoraVault` is a standalone contract that holds the funds itself. It is not a module bolted onto a wallet, so the wallet's owners or other modules have no side door around the delay. Tokens leave only three ways: an instant withdrawal within the allowance, a queued withdrawal after its delay, or a rescue to the recovery address.

There is **no** arbitrary-call function, **no** `approve`, **no** `delegatecall`, **no** upgrade path, and **no** native ETH. `MoraFactory` deploys one EIP-1167 clone per user, and clones point at one fixed implementation forever.

## Run it

```bash
npm install
npx hardhat test
```

35 contract tests cover setup, the allowance (including split and burst bypass attempts), curfew across midnight, minimum delays, cancel, freeze, rescue (including voiding the queue), delayed rule changes, and the full attack scenarios above.

30 more **parity tests** (`test/Parity.test.js`) keep the no-wallet demo honest: they drive the demo's simulator (`web/src/lib/sim.ts`) and the real contract through the same random sequences of withdrawals, cancels, freezes, rescues, rule changes and time jumps, at the same timestamps, and check after every step that balances, queue states, unlock times and `maxExtractableNow` all agree.

The project compiles with the npm-bundled `solc` 0.8.28 (solc-js), so no compiler download is needed.

### Deploy to Base Sepolia
Use a throwaway test wallet funded from a Base Sepolia faucet:
```bash
DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network baseSepolia
```
On Windows PowerShell (the key is read without landing in your shell history):
```powershell
$env:DEPLOYER_KEY = Read-Host "Deployer key"; npx hardhat run scripts/deploy.js --network baseSepolia; Remove-Item Env:DEPLOYER_KEY
```
This deploys a test USDC (`MockUSDC`) and the factory. Set `USDC_ADDRESS` to use an existing token instead.

## Honest limits

- **Unaudited.** Testnet only for now.
- **Only funds inside the vault are protected.** Your everyday wallet works as before.
- **A delay creates an intervention window. It doesn't guarantee safety.** It can't stop a captor who holds you longer than the delay. That's why guardians, freeze and rescue exist.
- **Curfew hours are set in UTC.** The app converts to your local time.
- **Guardians must be people you trust to respond.** A guardian can cause inconvenience, by freezing or rescuing to your own recovery address, but can't steal.
- **A leaked key burns the vault.** The thief and you hold the same owner key, so the contract can't tell you apart: the thief can cancel your own proposed changes, just as you can cancel theirs. Rescue gets the money out to your recovery wallet. After that, create a fresh vault with a new key rather than trying to win back the old one.
- **The delay only helps if someone is watching.** If no guardian notices a queued request before it unlocks, it goes through. That's why Mora sends guardian alerts, and why more than one guardian is better. Alerts run on GitHub's scheduler, which is usually on time but can lag 10–15 minutes, so keep the delay well above that.

## Web app

`web/` holds the Next.js app: the no-wallet **2:07 AM demo**, vault creation with a Base Account passkey, an owner and guardian dashboard, and a public page showing the most anyone can take right now. See [web/README.md](web/README.md).

## Roadmap

- Cancel straight from the Telegram alert (today the alert's button opens the vault page, where the guardian taps Cancel).
- Founder vaults for teams receiving Vibestarter tranches.
- An agent wallet mode: an AI agent spends small amounts instantly and anything large waits for your morning approval.

## Prior art

Argent's daily limits and guardians, Safe's Zodiac Delay module, and the 2026 exchange withdrawal locks all shaped this design. What Mora adds is rescue to a pre-committed address, curfew hours, delayed loosening of every control, and a public extractable-now check, as a standalone vault on Base.

## License

MIT
