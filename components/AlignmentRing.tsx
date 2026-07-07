"use client";

/**
 * Live face-detection feedback overlay (BUILD_PROMPT #1 + PLAYBOOK 1.4):
 * a ring that eases from amber to blue as the face centers, calm not jumpy.
 */

const HINT_COPY: Record<string, string> = {
  none: "Position your face in the frame",
  move_closer: "Move a little closer",
  face_straight: "Face the camera straight on",
  center: "Center your face in the frame",
  good: "Face found",
};

export function AlignmentRing({ hint }: { hint: string }) {
  const good = hint === "good";
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <svg viewBox="0 0 200 260" className="w-40 h-52 sm:w-48 sm:h-64" aria-hidden="true">
        <ellipse
          cx="100"
          cy="120"
          rx="70"
          ry="95"
          fill="none"
          strokeWidth="3"
          className="transition-all duration-500 ease-out"
          style={{ stroke: good ? "var(--color-accent)" : "var(--color-warn)" }}
          strokeDasharray="8 6"
        />
      </svg>
      <p
        className="mt-3 px-3 py-1.5 rounded-full text-sm font-medium bg-canvas/90 border border-rule shadow-card transition-colors duration-500"
        style={{ color: good ? "var(--color-accent)" : "var(--color-warn)" }}
      >
        {good ? "Face found ✓" : HINT_COPY[hint] ?? HINT_COPY.none}
      </p>
    </div>
  );
}
