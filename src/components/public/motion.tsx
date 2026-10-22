"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, MotionConfig, useInView, useReducedMotion } from "motion/react";
import { formatNairaShort, formatShare } from "@/lib/public/model";

/** Motion that explains, never decorates: everything here honours reduced-motion. */
export function PublicMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export type NumberFormat = "naira" | "percent" | "integer";

function format(value: number, kind: NumberFormat, digits: number) {
  if (kind === "naira") return formatNairaShort(value, digits);
  if (kind === "percent") return formatShare(value);
  return Math.round(value).toLocaleString("en-NG");
}

/**
 * Counts up from zero the first time it scrolls into view, then glides to new
 * values. The server renders the final value, so it reads correctly without JS.
 */
export function CountUp({
  value,
  kind,
  digits = 1,
  className,
}: {
  value: number | null;
  kind: NumberFormat;
  digits?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value ?? 0);
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    // Hide the server-rendered value until it can count up in view.
    if (!reduce && value !== null) setDisplay(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value === null) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const from = shown.current ?? 0;
    const controls = animate(from, value, {
      duration: shown.current === null ? 1.1 : 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        shown.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  if (value === null) return <span className={className}>—</span>;
  return (
    <span ref={ref} className={className} aria-label={format(value, kind, digits)}>
      <span aria-hidden>{format(display, kind, digits)}</span>
    </span>
  );
}

/** A bar segment that grows from zero when first seen and glides between values. */
export function GrowBar({
  fraction,
  className,
  style,
  delay = 0,
}: {
  fraction: number;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5% 0px" });
  const pct = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ width: 0 }}
      animate={{ width: inView ? pct : 0 }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

/** Progress ring for a single share (0–1). */
export function Ring({ fraction, size = 72, stroke = 8, color = "var(--pub-green)" }: { fraction: number; size?: number; stroke?: number; color?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true });
  const r = (size - stroke) / 2;
  return (
    <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pub-track)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: inView ? Math.max(0.001, Math.min(1, fraction)) : 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

/** Fades and lifts its children in as they enter the viewport. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
