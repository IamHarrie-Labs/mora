import { baseSepolia } from "viem/chains";

export const chain = baseSepolia;
export const explorer = "https://sepolia.basescan.org";

const addr = (v: string | undefined) => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : undefined);

/** Set these after running scripts/deploy.js (see README). */
export const FACTORY = addr(process.env.NEXT_PUBLIC_FACTORY_ADDRESS);
export const USDC = addr(process.env.NEXT_PUBLIC_USDC_ADDRESS);
export const isDeployed = Boolean(FACTORY && USDC);

/** True when USDC is the testnet MockUSDC, which anyone can mint for testing. */
export const canMintTestUsdc = process.env.NEXT_PUBLIC_USDC_IS_MOCK !== "false";

export const DECIMALS = 6;

/** Telegram bot username (no @) that runs guardian alerts; see alerts/README.md. */
export const ALERT_BOT = (process.env.NEXT_PUBLIC_ALERT_BOT || "").replace(/^@/, "") || undefined;
export const alertLink = (vault: string) => (ALERT_BOT ? `https://t.me/${ALERT_BOT}?start=${vault}` : undefined);
