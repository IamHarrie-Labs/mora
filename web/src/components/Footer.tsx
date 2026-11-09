import Link from "next/link";
import { LIVE, basescan } from "@/lib/proof";
import { ALERT_BOT } from "@/lib/config";
import { Mark } from "./Logo";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="flex flex-wrap items-end justify-between gap-10">
        <div className="text-sun">
          <Mark size={120} />
          <div className="wordmark mt-4 text-[64px] text-paper" style={{ color: "var(--paper)" }}>mora</div>
          <p className="mt-3 max-w-xs text-sm text-[#b3b3b3]">
            Latin for delay. A vault on Base for the crypto you hold yourself.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-14 gap-y-3 text-sm">
          <Link href="/demo">Play the demo</Link>
          <a href="https://github.com/IamHarrie-Labs/mora" target="_blank" rel="noreferrer">Source on GitHub</a>
          <Link href="/app">Your vaults</Link>
          <a href={basescan("address", LIVE.factory)} target="_blank" rel="noreferrer">Factory on Basescan</a>
          <Link href={`/v/${LIVE.vault}`}>The demo vault, live</Link>
          {ALERT_BOT && <a href={`https://t.me/${ALERT_BOT}`} target="_blank" rel="noreferrer">@{ALERT_BOT} on Telegram</a>}
        </div>
      </div>
      <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-[#333] pt-6 text-xs text-[#9a9a9a]">
        <span>Built for Vibestarter Vibeathon 02. Base Sepolia testnet. The contracts have not been audited.</span>
        <span>MIT licence</span>
      </div>
    </footer>
  );
}
