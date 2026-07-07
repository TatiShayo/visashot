"use client";

/**
 * Invisible Cloudflare Turnstile widget. No-ops (renders nothing, token stays
 * empty) when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set — the server-side mock
 * provider (lib/providers/turnstile.ts) accepts requests either way in that
 * case, so dev/testing is never blocked by a missing key.
 */

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; size?: string }
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Renders the (hidden, invisible-mode) Turnstile widget and returns the
 * verification token once solved. Element + token are owned by the same hook
 * so there's no ref-wiring mismatch between them.
 */
export function useTurnstile(): { token: string; mount: React.ReactElement | null } {
  const [token, setToken] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!SITE_KEY || rendered.current) return;

    function render() {
      if (!ref.current || !window.turnstile || rendered.current) return;
      window.turnstile.render(ref.current, {
        sitekey: SITE_KEY!,
        size: "invisible",
        callback: setToken,
      });
      rendered.current = true;
    }

    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, []);

  return { token, mount: SITE_KEY ? <div ref={ref} className="hidden" /> : null };
}
