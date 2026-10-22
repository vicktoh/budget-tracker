"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { AskHeaderButton } from "@/components/public/ask-panel";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/#explore", label: "Explore" },
  { href: "/phc", label: "Primary health care" },
  { href: "/reports", label: "Reports" },
  { href: "/data", label: "Open data" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--pub-line)] bg-[var(--pub-canvas)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--pub-canvas)]/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          <Image src="/kano-seal.png" alt="Kano State Government" width={46} height={42} priority className="h-10 w-auto" />
          <span className="leading-tight">
            <span className="font-display block whitespace-nowrap text-[1.05rem] font-semibold tracking-tight">Kano Health Budget</span>
            <span className="hidden whitespace-nowrap text-[11px] text-[var(--pub-muted)] min-[400px]:block">Kano State Government</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-2 text-sm text-[var(--pub-ink-2)] transition hover:bg-[var(--pub-mint)] hover:text-[var(--pub-green-deep)]",
                pathname === item.href && "font-semibold text-[var(--pub-green-deep)]",
              )}
            >
              {item.label}
            </Link>
          ))}
          <AskHeaderButton className="ml-2" />
          <Link
            href="/sign-in"
            className="ml-1 hidden whitespace-nowrap rounded-md px-2.5 py-2 text-sm text-[var(--pub-muted)] hover:text-[var(--pub-ink)] xl:inline-flex"
          >
            Staff sign-in
          </Link>
        </nav>
        <div className="flex items-center gap-2 lg:hidden">
        <AskHeaderButton className="px-3 py-1.5" label="Ask" />
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
