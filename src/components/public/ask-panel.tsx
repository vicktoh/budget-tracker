"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MaximizeIcon, SparklesIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";

// The chat (markdown, code highlighting, charts) is heavy: fetch it only when
// the panel is first opened, so the public pages stay light on mobile data.
const AskView = dynamic(() => import("@/components/public/ask-view").then((m) => m.AskView), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-[var(--pub-muted)]">Loading…</p>,
});
import { useAsk } from "@/components/public/ask-context";

export { AskProvider, useAsk } from "@/components/public/ask-context";
import { cn } from "@/lib/utils";

/**
 * "Ask AI" everywhere on the public site: a floating launcher, a header button
 * and contextual "Ask AI about…" buttons all open one
 * slide-in panel. The panel stays mounted after first use, so the conversation
 * survives closing and reopening it.
 */

/** Floating launcher + the slide-in panel. Not rendered on /ask, which has the full-page chat. */
export function AskPanel() {
  const pathname = usePathname();
  const { open, setOpen, ask } = useAsk();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => panelRef.current?.querySelector("textarea")?.focus(), 250);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, setOpen]);

  if (pathname === "/ask") return null;

  return (
    <>
      <AnimatePresence>
        {!open ? (
          <motion.button
            type="button"
            key="launcher"
            onClick={() => ask()}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
            className="group fixed bottom-5 right-4 z-40 inline-flex items-center gap-2.5 rounded-full bg-[var(--pub-accent)] py-3 pl-3.5 pr-5 text-[15px] font-semibold text-[var(--pub-navy)] shadow-[0_12px_30px_rgba(199,84,20,0.4)] ring-2 ring-white transition hover:bg-[var(--pub-accent-deep)] hover:text-white sm:bottom-6 sm:right-6"
            aria-label="Ask AI: ask a question about Kano's health budget"
          >
            <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-white/40">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/50 [animation-iteration-count:3] motion-reduce:hidden" />
              <SparklesIcon className="relative size-4" aria-hidden />
            </span>
            Ask AI
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-[rgba(20,32,26,0.28)] backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      {mounted ? (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Ask AI"
          aria-hidden={!open}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[var(--pub-canvas)] shadow-[-20px_0_60px_rgba(20,32,26,0.18)] sm:w-[30rem] sm:rounded-l-2xl",
            !open && "pointer-events-none",
          )}
          initial={{ x: "100%" }}
          animate={{ x: open ? 0 : "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
          style={{ visibility: open ? "visible" : "hidden" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--pub-line)] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--pub-accent)] text-[var(--pub-navy)]">
                <SparklesIcon className="size-4" aria-hidden />
              </span>
              <div className="leading-tight">
                <p className="font-display text-xl">Ask AI</p>
                <p className="text-xs text-[var(--pub-muted)]">English or Hausa · answers from the official reports</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/ask"
                onClick={() => setOpen(false)}
                className="hidden size-9 items-center justify-center rounded-md text-[var(--pub-muted)] hover:bg-white hover:text-[var(--pub-ink)] sm:inline-flex"
                title="Open full page"
              >
                <MaximizeIcon className="size-4" />
                <span className="sr-only">Open full page</span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-md text-[var(--pub-muted)] hover:bg-white hover:text-[var(--pub-ink)]"
              >
                <XIcon className="size-5" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 px-3 pb-3 pt-3">
            <AskView variant="panel" />
          </div>
        </motion.div>
      ) : null}
    </>
  );
}

/** Contextual entry point, e.g. "Ask about PHC programmes". */
export function AskButton({ question, label = "Ask AI about this", className }: { question: string; label?: string; className?: string }) {
  const { ask } = useAsk();
  return (
    <button
      type="button"
      onClick={() => ask(question)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--pub-brand)]/30 bg-[var(--pub-brand-soft)] px-3.5 py-2 text-sm font-medium text-[var(--pub-brand-deep)] transition hover:border-[var(--pub-brand)] hover:bg-white",
        className,
      )}
    >
      <SparklesIcon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

/** Header button (desktop and mobile menu). */
export function AskHeaderButton({ onClick, className, label = "Ask AI" }: { onClick?: () => void; className?: string; label?: string }) {
  const { ask } = useAsk();
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        ask();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--pub-accent)] px-4 py-2 text-sm font-semibold text-[var(--pub-navy)] shadow-sm transition hover:bg-[var(--pub-accent-deep)] hover:text-white",
        className,
      )}
    >
      <SparklesIcon className="size-4" aria-hidden />
      {label}
    </button>
  );
}
