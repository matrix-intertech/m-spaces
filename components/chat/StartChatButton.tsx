"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, MessageCircle, X } from "lucide-react";
import { backendUrl } from "@/lib/config";

export function StartChatButton({ propertyId }: { propertyId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  async function startChat() {
    setError("");
    setLoading(true);
    try {
      const csrfResponse = await fetch(backendUrl("/api/csrf-token"), {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const csrfPayload = csrfResponse.ok ? ((await csrfResponse.json().catch(() => ({}))) as { csrfToken?: string }) : {};
      const response = await fetch(backendUrl(`/chat/conversations/${propertyId}/start`), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(csrfPayload.csrfToken ? { "X-CSRF-Token": csrfPayload.csrfToken } : {})
        }
      });

      const payload = (await response.json().catch(() => ({}))) as { conversationId?: number; error?: string };
      if (response.status === 401) {
        setShowLoginPrompt(true);
        return;
      }
      if (!response.ok || !payload.conversationId) {
        throw new Error(payload.error || "Could not start chat.");
      }

      router.push(`/messages/${payload.conversationId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start chat.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: "grid", gap: ".45rem" }}>
        <button className="btn btn-primary w-full rounded-md" type="button" onClick={() => void startChat()} disabled={loading}>
          <MessageCircle size={18} aria-hidden />
          {loading ? "Opening chat..." : "Chat with Property Manager"}
        </button>
        {error ? <p style={{ margin: 0, fontSize: ".8rem", fontWeight: 700, color: "#b91c1c" }}>{error}</p> : null}
      </div>

      {showLoginPrompt ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowLoginPrompt(false)}
              className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
              aria-label="Close login prompt"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <LogIn className="h-6 w-6" aria-hidden />
            </div>

            <h3 className="mt-4 text-2xl font-black text-slate-950">Login required</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Please log in to start a conversation with the property manager.
            </p>

            <div className="mt-5 grid gap-3">
              <Link
                href="/login"
                className="btn btn-primary w-full rounded-md justify-center"
                onClick={() => setShowLoginPrompt(false)}
              >
                <LogIn size={18} aria-hidden />
                Login
              </Link>
              <Link
                href="/login?tab=signup"
                className="btn btn-secondary w-full rounded-md justify-center"
                onClick={() => setShowLoginPrompt(false)}
              >
                Create account
              </Link>
              <button
                type="button"
                onClick={() => setShowLoginPrompt(false)}
                className="w-full rounded-md border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Continue browsing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
