"use client";

import { useState } from "react";
import { Heart, Scale, Share2 } from "lucide-react";

export function PropertyActions({
  propertyId,
  title,
  compact = false
}: {
  propertyId: number;
  title: string;
  compact?: boolean;
}) {
  const [busyAction, setBusyAction] = useState<"favorite" | "compare" | "share" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [favoriteOn, setFavoriteOn] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  const buttonClassName = compact ? "btn btn-secondary min-h-10 rounded-full px-3" : "btn btn-secondary";

  async function runAction(action: "favorite" | "compare" | "share", callback: () => Promise<string>) {
    setBusyAction(action);
    setMessage(null);
    try {
      setMessage(await callback());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div style={{ display: "contents" }}>
      <button
        className={buttonClassName}
        type="button"
        aria-label="Add to favorites"
        title="Favorite"
        disabled={busyAction === "favorite"}
        style={favoriteOn ? { borderColor: "#ef4444", color: "#ef4444" } : undefined}
        onClick={() =>
          runAction("favorite", async () => {
            const response = await fetch(`/api/favorites/${propertyId}`, {
              method: "POST",
              credentials: "include",
              headers: { Accept: "application/json" }
            });
            const payload = (await response.json().catch(() => ({}))) as { message?: string; data?: { action?: string } };
            if (!response.ok) throw new Error(payload.message ?? "Favorite update failed");
            const action = payload?.data?.action;
            if (action === "added") setFavoriteOn(true);
            if (action === "removed") setFavoriteOn(false);
            return action === "added" ? "Added to favorites" : "Removed from favorites";
          })
        }
      >
        <Heart size={18} aria-hidden />
        {!compact ? null : <span className="sr-only">Favorite</span>}
      </button>
      <button
        className={buttonClassName}
        type="button"
        aria-label="Compare property"
        title="Compare"
        disabled={busyAction === "compare"}
        style={compareOn ? { borderColor: "#2563eb", color: "#2563eb" } : undefined}
        onClick={() =>
          runAction("compare", async () => {
            const response = await fetch("/api/compare/toggle", {
              method: "POST",
              credentials: "include",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ propertyId })
            });
            const payload = (await response.json().catch(() => ({}))) as { message?: string; added?: boolean };
            if (!response.ok) throw new Error(payload.message ?? "Compare update failed");
            if (typeof payload.added === "boolean") setCompareOn(payload.added);
            return typeof payload.added === "boolean"
              ? payload.added
                ? "Added to compare"
                : "Removed from compare"
              : "Compare list updated";
          })
        }
      >
        <Scale size={18} aria-hidden />
        {!compact ? null : <span className="sr-only">Compare</span>}
      </button>
      <button
        className={buttonClassName}
        type="button"
        aria-label="Share property"
        title="Share"
        disabled={busyAction === "share"}
        onClick={() =>
          runAction("share", async () => {
            const url = `${window.location.origin}/property/${propertyId}`;
            if (navigator.share) {
              await navigator.share({ title, url });
              return "Shared";
            }
            try {
              await navigator.clipboard.writeText(url);
              return "Link copied";
            } catch {
              const input = document.createElement("input");
              input.value = url;
              document.body.appendChild(input);
              input.select();
              document.execCommand("copy");
              document.body.removeChild(input);
              return "Link copied";
            }
          })
        }
      >
        <Share2 size={18} aria-hidden />
        {!compact ? null : <span className="sr-only">Share</span>}
      </button>
      {message ? (
        <span aria-live="polite" style={{ gridColumn: "1 / -1", color: "var(--ms-muted)", fontSize: ".78rem", fontWeight: 700 }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
