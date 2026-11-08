"use client";

import Link from "next/link";
import { ConnectButton } from "./ConnectButton";

export function Header() {
  return (
    <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
        <Moon /> Mora
      </Link>
      <nav className="flex items-center gap-2 sm:gap-4 text-sm">
        <Link href="/demo" className="text-muted hover:text-ink">Demo</Link>
        <Link href="/app" className="text-muted hover:text-ink">My vaults</Link>
        <ConnectButton />
      </nav>
    </header>
  );
}

export function Moon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="var(--moon)" />
    </svg>
  );
}
