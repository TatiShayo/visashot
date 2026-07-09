"use client";

/**
 * Global error boundary — catches errors thrown in the root layout itself.
 * Must render its own <html>/<body> because it replaces the root layout.
 * Reports to monitoring (Sentry once wired) and offers a full reload.
 */

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring-client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    reportClientError(error, { scope: "global", digest: error.digest ?? null });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#ffffff",
          color: "#1b2a4a",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#dc2626",
              marginBottom: "0.75rem",
            }}
          >
            Unexpected error
          </p>
          <h1 style={{ fontSize: "2rem", fontWeight: 650, margin: "0 0 0.75rem" }}>
            We hit a snag
          </h1>
          <p style={{ color: "#44506b", lineHeight: 1.6, marginBottom: "2rem" }}>
            Your photo is safe and nothing was charged. Please reload the page.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- this
              boundary replaces the root layout entirely (renders its own
              <html>/<body>), so next/link's router context isn't available. */}
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "0.375rem",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Reload
          </a>
        </div>
      </body>
    </html>
  );
}
