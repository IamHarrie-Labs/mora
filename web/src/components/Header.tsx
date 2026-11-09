"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectButton } from "./ConnectButton";
import { Lockup } from "./Logo";

export function Header() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const current = (p: string) => (path === p ? "page" : undefined);

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="inner">
        <Link href="/" aria-label="Mora home">
          <Lockup size={40} />
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link className="navlink hide-sm" href="/#how">How it works</Link>
          <Link className="navlink" href="/demo" aria-current={current("/demo")}>Demo</Link>
          <Link className="navlink hide-sm" href="/app" aria-current={current("/app")}>Your vaults</Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
