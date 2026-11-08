# Mora web app

Next.js app for Mora on Base Sepolia.

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/demo` | The no-wallet "2:07 AM" demo. Two scenarios (stolen key, forced at home) run on an in-browser simulation of the vault rules (`src/lib/sim.ts`). |
| `/app` | Connect (Base Account passkey or browser wallet), list your vaults, create one |
| `/vault/[address]` | Dashboard: deposit, withdraw, waiting transfers with countdowns, cancel and send, freeze, rescue, settings and rule changes. Shows owner or guardian controls based on the connected wallet. |
| `/v/[address]` | Public "sign on the door": the most anyone can take right now, read live from the contract |

## Run locally

```bash
cp .env.example .env.local   # fill in the addresses printed by the deploy script
npm install
npm run dev
```

Without addresses, `/demo` and the landing page still work, and the wallet pages show a "contracts not connected" notice.

## Deploy to Vercel

Import the repo, set **Root Directory** to `web`, and add the environment variables from `.env.example`.

## Contract ABIs

`src/lib/abi.ts` is generated. After changing a contract, run `npm run abi` in the repo root.
