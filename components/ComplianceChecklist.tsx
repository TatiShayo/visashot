"use client";

/**
 * The signature interaction (PLAYBOOK 1.4 / BUILD_PROMPT "Polish"):
 * blueprint-style guide lines (head-height bracket, eye-line rule) draw in
 * with mono measurement labels, then checklist items tick sequentially, then
 * an embossed "COMPLIANT" seal stamps in on all-green. ~4 seconds total.
 * Respects prefers-reduced-motion (guarded globally in globals.css, and here
 * via the `motion-safe`/`motion-reduce` Tailwind variants).
 */

import { useEffect, useState } from "react";
import type { CheckItem, CheckStatus } from "@/lib/compliance";

const STATUS_STYLE: Record<CheckStatus, { fg: string; bg: string; icon: string }> = {
  pass: { fg: "text-pass", bg: "bg-pass-bg", icon: "✓" },
  warn: { fg: "text-warn", bg: "bg-warn-bg", icon: "⚠" },
  fail: { fg: "text-fail", bg: "bg-fail-bg", icon: "✕" },
};

export function ComplianceChecklist({
  checks,
  overall,
  headHeightPct,
  eyeLinePct,
}: {
  checks: CheckItem[];
  overall: CheckStatus;
  headHeightPct: number;
  eyeLinePct: number;
}) {
  const [guidesIn, setGuidesIn] = useState(false);
  const [tickedCount, setTickedCount] = useState(0);
  const [sealIn, setSealIn] = useState(false);

  useEffect(() => {
    setGuidesIn(false);
    setTickedCount(0);
    setSealIn(false);

    const t0 = setTimeout(() => setGuidesIn(true), 50);
    // Ticks land sequentially after the guides draw in.
    const tickTimers = checks.map((_, i) =>
      setTimeout(() => setTickedCount((n) => Math.max(n, i + 1)), 700 + i * 220)
    );
    const sealTimer =
      overall === "pass"
        ? setTimeout(() => setSealIn(true), 700 + checks.length * 220 + 300)
        : undefined;

    return () => {
      clearTimeout(t0);
      tickTimers.forEach(clearTimeout);
      if (sealTimer) clearTimeout(sealTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checks.length, overall]);

  return (
    <div className="relative">
      {/* Blueprint guide-line diagram */}
      <div className="relative mx-auto mb-6 w-40 sm:w-48 aspect-[3/4] rounded-card border border-rule bg-paper overflow-hidden">
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-accent/70 transition-all duration-700 ease-out motion-reduce:transition-none"
          style={{
            top: `${100 - headHeightPct}%`,
            opacity: guidesIn ? 1 : 0,
            transform: guidesIn ? "translateY(0)" : "translateY(-8px)",
          }}
        >
          <span className="absolute -top-5 right-1 font-mono text-[10px] tnum text-accent">
            {headHeightPct.toFixed(0)}%
          </span>
        </div>
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-ink-soft/60 transition-all duration-700 ease-out delay-150 motion-reduce:transition-none"
          style={{
            bottom: `${eyeLinePct}%`,
            opacity: guidesIn ? 1 : 0,
            transform: guidesIn ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <span className="absolute -bottom-5 left-1 font-mono text-[10px] tnum text-ink-soft">
            eye {eyeLinePct.toFixed(0)}%
          </span>
        </div>

        {sealIn && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/40">
            <div
              className="animate-[seal-stamp_420ms_cubic-bezier(0.2,1.4,0.4,1)_forwards] rounded-full border-4 border-pass text-pass font-mono text-[11px] font-bold uppercase tracking-widest w-24 h-24 flex items-center justify-center text-center leading-tight -rotate-12 shadow-lift"
            >
              Compliant
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {checks.map((c, i) => {
          const ticked = i < tickedCount;
          const style = STATUS_STYLE[c.status];
          return (
            <li
              key={c.id}
              className={`flex items-start gap-3 rounded-md border border-rule px-3 py-2.5 transition-all duration-300 motion-reduce:transition-none ${
                ticked ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.bg} ${style.fg}`}
              >
                {ticked ? style.icon : ""}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-ink">{c.label}</span>
                {c.tip && ticked && c.status !== "pass" && (
                  <span className={`block text-xs mt-0.5 ${style.fg}`}>{c.tip}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <style jsx global>{`
        @keyframes seal-stamp {
          0% {
            opacity: 0;
            transform: scale(1.6) rotate(-12deg);
          }
          70% {
            opacity: 1;
            transform: scale(0.94) rotate(-12deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(-12deg);
          }
        }
      `}</style>
    </div>
  );
}
