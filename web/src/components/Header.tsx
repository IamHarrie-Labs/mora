"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectButton } from "./ConnectButton";
import { Lockup } from "./Logo";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/demo", label: "Demo" },
  { href: "/app", label: "Your vaults" },
];

export function Header() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Close the phone menu on navigation and on Escape.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const current = (p: string) => (path === p ? "page" : undefined);

  return (
    <header className="site-header" data-scrolled={scrolled || open}>
      <div className="inner">
        <Link href="/" aria-label="Mora home" className="flex min-h-11 items-center">
          <Lockup size={40} />
        </Link>
        <nav className="site-nav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} className="navlink hide-sm" href={l.href} aria-current={current(l.href)}>
              {l.label}
            </Link>
          ))}
          <ConnectButton />
          <button
            className="menu-btn"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="phone-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span data-open={open} />
          </button>
        </nav>
      </div>
      {open && (
        <div id="phone-menu" className="phone-menu">
          {LINKS.map((l, i) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href)} onClick={() => setOpen(false)}>
              <span className="num text-sm text-muted">0{i + 1}</span>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
