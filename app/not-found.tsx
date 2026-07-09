/**
 * 404 — designed, typographic empty state (PLAYBOOK 1.5), one clear action.
 * No emoji, no illustration clutter — Swiss-precision line work only.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-20 text-center">
      <p className="font-mono text-6xl sm:text-7xl tnum text-rule-strong mb-4">
        404
      </p>
      <h1 className="display text-2xl sm:text-3xl mb-3">
        This page isn&apos;t on file
      </h1>
      <p className="text-ink-soft mb-8 leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist, or it may have moved.
        Browse every supported photo format, or start a new photo.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/create"
          className="h-11 px-6 rounded-md bg-accent text-white font-medium inline-flex items-center hover:bg-accent-hover transition-colors"
        >
          Start your photo
        </Link>
        <Link
          href="/photo"
          className="h-11 px-6 rounded-md border border-rule-strong font-medium inline-flex items-center hover:border-ink-faint transition-colors"
        >
          All photo types
        </Link>
      </div>
    </div>
  );
}
