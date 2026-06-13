"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Property } from "@/types";

const DynamicPropertyMap = dynamic(
  () => import("@/components/map/PropertyMap").then((module) => module.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="surface"
        style={{
          display: "grid",
          minHeight: 320,
          placeItems: "center",
          color: "var(--ms-muted)",
          fontWeight: 800,
          background:
            "linear-gradient(110deg, rgba(248,250,252,0.96) 8%, rgba(226,232,240,0.92) 18%, rgba(248,250,252,0.96) 33%)",
          backgroundSize: "200% 100%",
          animation: "msMapShimmer 1.35s linear infinite"
        }}
      >
        Preparing map...
      </div>
    )
  }
);

type MapLoadStrategy = "immediate" | "idle" | "visible";

export function PropertyMapIsland({
  properties,
  height,
  showNearbyPlaces,
  showSearchControl,
  loadStrategy = "immediate"
}: {
  properties: Property[];
  height?: number;
  showNearbyPlaces?: boolean;
  showSearchControl?: boolean;
  loadStrategy?: MapLoadStrategy;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(loadStrategy === "immediate");

  useEffect(() => {
    if (shouldLoad || loadStrategy === "immediate") return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let observer: IntersectionObserver | null = null;
    let idleId: number | null = null;

    const activate = () => {
      if (!cancelled) setShouldLoad(true);
    };

    if (loadStrategy === "idle") {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(activate, { timeout: 1500 });
      } else {
        timeoutId = setTimeout(activate, 700);
      }
      return () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (idleId !== null && "cancelIdleCallback" in window) {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    if ("IntersectionObserver" in window && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            activate();
            observer?.disconnect();
          }
        },
        { rootMargin: "260px 0px" }
      );
      observer.observe(containerRef.current);
      timeoutId = setTimeout(activate, 3000);
    } else {
      timeoutId = setTimeout(activate, 900);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loadStrategy, shouldLoad]);

  if (!shouldLoad) {
    return (
      <div
        ref={containerRef}
        className="surface"
        style={{
          display: "grid",
          minHeight: height ?? 320,
          placeItems: "center",
          borderRadius: 12,
          color: "var(--ms-muted)",
          textAlign: "center",
          padding: "1rem"
        }}
      >
        <div>
          <strong style={{ display: "block", fontSize: "1rem", color: "var(--ms-ink)" }}>Preparing live map</strong>
          <p style={{ margin: ".45rem 0 0", fontSize: ".9rem", fontWeight: 700 }}>
            The map loads right after the rest of the page is ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @keyframes msMapShimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      <DynamicPropertyMap
        properties={properties}
        height={height}
        showNearbyPlaces={showNearbyPlaces}
        showSearchControl={showSearchControl}
      />
    </>
  );
}
