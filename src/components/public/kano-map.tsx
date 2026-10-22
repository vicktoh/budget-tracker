"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { KANO_LGAS, KANO_VIEWBOX } from "@/lib/public/kano-map";

const SHADES = ["#0b5566", "#00798c", "#00879b", "#1fa6ba", "#14b0c8", "#0e6d80"];
const CAPITAL = "Kano Municipal";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Decorative, interactive map of Kano State's 44 LGAs for the hero. It shows
 * no figures (the BIRs have none by LGA): outlines draw outward from Kano
 * Municipal, pulses ripple from the capital, and the map tours LGA names
 * until the visitor hovers or taps one.
 */
export function KanoMap({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [, , w, h] = KANO_VIEWBOX.split(" ").map(Number);
  const capital = KANO_LGAS.find((l) => l.name === CAPITAL) ?? KANO_LGAS[0];
  const lgas = useMemo(() => {
    const maxD = Math.max(...KANO_LGAS.map((l) => Math.hypot(l.cx - capital.cx, l.cy - capital.cy)));
    return KANO_LGAS.map((l) => ({
      ...l,
      shade: SHADES[hash(l.name) % SHADES.length],
      delay: (Math.hypot(l.cx - capital.cx, l.cy - capital.cy) / maxD) * 1.4,
    }));
  }, [capital]);
  const [active, setActive] = useState<string | null>(null);
  const [touring, setTouring] = useState<string | null>(null);
  const [userActive, setUserActive] = useState(false);

  // Auto-tour LGA names until the visitor interacts.
  useEffect(() => {
    if (reduce || userActive) return;
    let i = hash("start") % lgas.length;
    const start = window.setTimeout(() => setTouring(lgas[i].name), 2600);
    const id = window.setInterval(() => {
      i = (i + 7) % lgas.length;
      setTouring(lgas[i].name);
    }, 2200);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [reduce, userActive, lgas]);

  const shown = active ?? (userActive ? null : touring);
  const label = lgas.find((l) => l.name === shown);

  return (
    <div className={className}>
      <div className="relative">
        <svg viewBox={KANO_VIEWBOX} role="img" aria-label="Map of Kano State's 44 local government areas" className="h-auto w-full overflow-visible">
          <defs>
            <filter id="kano-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="kano-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6fd3d9" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6fd3d9" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={capital.cx} cy={capital.cy} r={w * 0.55} fill="url(#kano-halo)" />
          <g filter="url(#kano-glow)">
            {lgas.map((l) => {
              const on = shown === l.name;
              return (
                <motion.path
                  key={l.name}
                  d={l.d}
                  stroke="#bfeef2"
                  strokeWidth={on ? 2 : 0.9}
                  strokeLinejoin="round"
                  initial={reduce ? false : { pathLength: 0, fillOpacity: 0 }}
                  animate={{ pathLength: 1, fillOpacity: on ? 1 : 0.85, fill: on ? "#ff7a2e" : l.shade }}
                  transition={{
                    pathLength: { duration: 1.1, delay: l.delay, ease: [0.16, 1, 0.3, 1] },
                    fillOpacity: { duration: 0.6, delay: reduce ? 0 : l.delay + 0.5 },
                    fill: { duration: 0.35 },
                  }}
                  className="cursor-pointer outline-none"
                  tabIndex={0}
                  aria-label={l.name}
                  onMouseEnter={() => {
                    setUserActive(true);
                    setActive(l.name);
                  }}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => {
                    setUserActive(true);
                    setActive(l.name);
                  }}
                  onBlur={() => setActive(null)}
                  onClick={() => {
                    setUserActive(true);
                    setActive((a) => (a === l.name ? null : l.name));
                  }}
                />
              );
            })}
          </g>
          {/* Pulses from the state capital */}
          {!reduce
            ? [0, 1, 2].map((i) => (
                <circle
                  key={i}
                  cx={capital.cx}
                  cy={capital.cy}
                  r={w * 0.32}
                  fill="none"
                  stroke={i === 1 ? "#ff7a2e" : "#6fd3d9"}
                  strokeWidth={2}
                  style={{
                    transformOrigin: `${capital.cx}px ${capital.cy}px`,
                    animation: `pub-pulse 3.6s ${2 + i * 1.2}s ease-out infinite`,
                    opacity: 0,
                  }}
                  pointerEvents="none"
                />
              ))
            : null}
          <circle cx={capital.cx} cy={capital.cy} r={6} fill="#ff7a2e" stroke="#fff" strokeWidth={2} pointerEvents="none" />
        </svg>
        {label ? (
          <motion.div
            key={label.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm font-semibold text-[var(--pub-navy)] shadow-lg"
            style={{ left: `${(label.cx / w) * 100}%`, top: `calc(${(label.cy / h) * 100}% - 10px)` }}
          >
            {label.name}
            {label.name === CAPITAL ? <span className="ml-1 font-normal text-[var(--pub-muted)]">· state capital</span> : null}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
