import type { ReactNode } from "react";

/** Deep IBP-teal page header band used across the public pages. */
export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-[var(--pub-navy)] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_320px_at_90%_0%,rgba(20,176,200,0.35),transparent_60%),radial-gradient(500px_260px_at_0%_120%,rgba(255,122,46,0.22),transparent_60%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pub-aqua)]">{eyebrow}</p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl leading-tight sm:text-5xl">{title}</h1>
        {children ? <div className="mt-3 max-w-2xl text-lg leading-relaxed text-white/80">{children}</div> : null}
      </div>
    </section>
  );
}
