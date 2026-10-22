"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/#explore", label: "Explore" },
  { href: "/phc", label: "Primary health care" },
  { href: "/reports", label: "Reports" },
  { href: "/ask", label: "Ask the data" },
  { href: "/data", label: "Open data" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--pub-line)] bg-[var(--pub-canvas)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--pub-canvas)]/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Mark />
          <span className="leading-tight">
            <span className="font-display block text-[1.05rem] font-semibold tracking-tight">Kano Health Budget</span>
            <span className="block text-[11px] text-[var(--pub-muted)]">Official figures, every quarter</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-[var(--pub-ink-2)] transition hover:bg-[var(--pub-mint)] hover:text-[var(--pub-green-deep)]",
                pathname === item.href && "font-semibold text-[var(--pub-green-deep)]",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/sign-in"
            className="ml-2 rounded-md border border-[var(--pub-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--pub-ink-2)] hover:border-[var(--pub-green)]"
          >
            Staff sign-in
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--pub-line)] bg-white lg:hidden"
          aria-expanded={open}
          aria-controls="public-mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          <span className="sr-only">Menu</span>
        </button>
      </div>
      {open ? (
        <nav id="public-mobile-nav" aria-label="Main" className="border-t border-[var(--pub-line)] bg-white px-4 py-3 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-3 text-base text-[var(--pub-ink)] hover:bg-[var(--pub-mint)]"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/sign-in" className="mt-2 block rounded-md px-3 py-3 text-base text-[var(--pub-muted)]">
            Staff sign-in
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <rect width="34" height="34" rx="9" fill="var(--pub-green)" />
      <rect x="8" y="19" width="4" height="8" rx="1.5" fill="#cfe9d9" />
      <rect x="15" y="13" width="4" height="14" rx="1.5" fill="#ffffff" />
      <rect x="22" y="8" width="4" height="19" rx="1.5" fill="#cfe9d9" />
    </svg>
  );
}
