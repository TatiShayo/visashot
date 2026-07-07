"use client";

/**
 * Draggable before/after slider for the background-removal result
 * (BUILD_PROMPT: "presented as a draggable before/after slider — let users
 * feel the magic"). Pure CSS clip via a range input, no image libs needed.
 */

import { useState, useRef, useCallback } from "react";

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Original",
  afterLabel = "Processed",
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    setPct(Math.min(100, Math.max(0, ratio * 100)));
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative select-none rounded-card overflow-hidden border border-rule bg-paper aspect-[3/4] max-h-[480px] mx-auto touch-none"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        updateFromClientX(e.clientX);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterSrc} alt={afterLabel} className="absolute inset-0 w-full h-full object-contain" />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeSrc} alt={beforeLabel} className="absolute inset-0 w-full h-full object-contain" />
      </div>

      <div
        className="absolute top-0 bottom-0 w-0.5 bg-accent shadow-lift"
        style={{ left: `${pct}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 h-9 w-9 rounded-full bg-accent text-white flex items-center justify-center shadow-lift text-xs font-mono">
          ⇔
        </div>
      </div>

      <span className="absolute top-2 left-2 text-xs font-mono px-2 py-1 rounded bg-canvas/80 text-ink-soft">
        {beforeLabel}
      </span>
      <span className="absolute top-2 right-2 text-xs font-mono px-2 py-1 rounded bg-canvas/80 text-ink-soft">
        {afterLabel}
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="absolute inset-x-0 bottom-2 mx-auto w-1/2 opacity-0 hover:opacity-0 h-6 cursor-ew-resize"
        aria-label="Drag to compare original and processed photo"
      />
    </div>
  );
}
