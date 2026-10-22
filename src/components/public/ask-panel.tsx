"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRightIcon, MaximizeIcon, SendHorizonalIcon, SparklesIcon, XIcon } from "lucide-react";
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
 * "Ask the data" everywhere on the public site: a floating launcher, a header
 * button, a hero ask box and contextual "Ask about this" buttons all open one
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
            className="group fixed bottom-5 right-4 z-40 inline-flex items-center gap-2.5 rounded-full bg-[var(--pub-green-deep)] py-3 pl-3.5 pr-5 text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(15,81,50,0.35)] ring-1 ring-white/10 transition hover:bg-[var(--pub-green)] sm:bottom-6 sm:right-6"
            aria-label="Ask the data: ask a question about Kano's health budget"
          >
            <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-white/15">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/25 [animation-iteration-count:3] motion-reduce:hidden" />
              <SparklesIcon className="relative size-4" aria-hidden />
            </span>
            Ask the data
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
          aria-label="Ask the data"
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
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--pub-green-deep)] text-white">
                <SparklesIcon className="size-4" aria-hidden />
              </span>
              <div className="leading-tight">
                <p className="font-display text-lg font-semibold">Ask the data</p>
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
export function AskButton({ question, label = "Ask about this", className }: { question: string; label?: string; className?: string }) {
  const { ask } = useAsk();
  return (
    <button
      type="button"
      onClick={() => ask(question)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--pub-green)]/30 bg-[var(--pub-mint)] px-3.5 py-2 text-sm font-medium text-[var(--pub-green-deep)] transition hover:border-[var(--pub-green)] hover:bg-white",
        className,
      )}
    >
      <SparklesIcon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

/** Header button (desktop and mobile menu). */
export function AskHeaderButton({ onClick, className, label = "Ask the data" }: { onClick?: () => void; className?: string; label?: string }) {
  const { ask } = useAsk();
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        ask();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--pub-green-deep)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--pub-green)]",
        className,
      )}
    >
      <SparklesIcon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

const HERO_EXAMPLES = [
  "How much of the health budget has been spent this year?",
  "Which MDAs have spent the least of their budget?",
  "Nawa aka ware wa fannin lafiya a 2026?",
];

/** The big ask box in the landing hero. */
export function AskHeroBox() {
  const { ask } = useAsk();
  const [text, setText] = useState("");
  return (
    <div className="rounded-2xl border border-[var(--pub-green)]/25 bg-white/90 p-3 shadow-[0_12px_40px_rgba(22,122,74,0.10)] backdrop-blur sm:p-4">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return ask();
          ask(text.trim());
          setText("");
        }}
      >
        <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--pub-green-deep)] text-white sm:inline-flex">
          <SparklesIcon className="size-5" aria-hidden />
        </span>
        <label className="sr-only" htmlFor="hero-ask">
          Ask a question about Kano&apos;s health budget
        </label>
        <input
          id="hero-ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Ask anything about Kano's health budget…"
          className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--pub-line)] bg-[var(--pub-canvas)] px-4 text-base outline-none transition focus:border-[var(--pub-green)] focus:bg-white"
        />
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[var(--pub-green)] px-4 font-semibold text-white transition hover:bg-[var(--pub-green-deep)]"
        >
          <span className="hidden sm:inline">Ask</span>
          <SendHorizonalIcon className="size-4" aria-hidden />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {HERO_EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--pub-line)] bg-white px-3 py-1.5 text-left text-xs text-[var(--pub-ink-2)] transition hover:border-[var(--pub-green)] hover:text-[var(--pub-green-deep)] sm:text-sm"
          >
            {q}
            <ArrowUpRightIcon className="size-3.5 shrink-0" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
