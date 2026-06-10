"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, string>) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

export function TurnstileSignupField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.turnstile) setReady(true);
  }, []);

  useEffect(() => {
    if (!turnstileSiteKey || !ready || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: turnstileSiteKey,
      theme: "auto",
      action: "signup"
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [ready]);

  if (!turnstileSiteKey) return null;

  return (
    <div className="grid min-h-[65px] place-items-center rounded-md border border-slate-200 bg-slate-50/70 p-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div ref={containerRef} />
    </div>
  );
}
