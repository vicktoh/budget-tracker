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
  { href: "/explore", label: "Explore" },
  { href: "/phc", label: "Health programmes" },
  { href: "/revenue", label: "Revenue" },
  { href: "/reports", label: "Reports" },
  { href: "/data", label: "Open data" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--pub-line)] bg-[var(--pub-canvas)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--pub-canvas)]/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5" onClick={() => setOpen(false)}>
          <Image src="/kano-seal.png" alt="Kano State Government" width={46} height={42} priority className="h-9 w-auto sm:h-10" />
          <span className="leading-tight">
            <span className="font-display block whitespace-nowrap text-[1rem] sm:text-[1.1rem]">Kano Health Budget</span>
            <span className="hidden whitespace-nowrap text-[11px] text-[var(--pub-muted)] min-[400px]:block">Kano State Government</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-2 text-sm text-[var(--pub-ink-2)] transition hover:bg-[var(--pub-brand-soft)] hover:text-[var(--pub-brand-deep)]",
                pathname === item.href && "font-semibold text-[var(--pub-brand-deep)]",
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
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
        <AskHeaderButton className="px-3 py-1.5 max-[379px]:hidden" label="Ask AI" />
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--pub-line)] bg-white sm:size-10 lg:hidden"
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
              className="block rounded-md px-3 py-3 text-base text-[var(--pub-ink)] hover:bg-[var(--pub-brand-soft)]"
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
