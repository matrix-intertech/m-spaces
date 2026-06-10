"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { getClientCsrfToken } from "@/lib/csrf-client";
import { backendBaseUrl } from "@/lib/config";
import { formatTime } from "@/lib/format";
import type { ChatMessage } from "@/types";

export function ChatWindow({
  conversationId,
  initialMessages,
  currentUserId
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  currentUserId?: number | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function syncMessages(markRead = false) {
      const response = await fetch(`${backendBaseUrl}/chat/conversations/${conversationId}/messages`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) return;

      const payload = (await response.json()) as { messages?: ChatMessage[] };
      setMessages([...(payload.messages ?? [])].reverse());

      if (!markRead) return;
      const csrfToken = await getClientCsrfToken().catch(() => "");
      await fetch(`${backendBaseUrl}/chat/conversations/${conversationId}/read`, {
        method: "PATCH",
        credentials: "include",
        signal: controller.signal,
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined
      }).catch(() => undefined);
    }

    void syncMessages(true).catch(() => undefined);
    const pollId = window.setInterval(() => {
      void syncMessages(false).catch(() => undefined);
    }, 5000);

    return () => {
      controller.abort();
      window.clearInterval(pollId);
    };
  }, [conversationId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try {
      const csrfToken = await getClientCsrfToken();
      const response = await fetch(`${backendBaseUrl}/chat/conversations/${conversationId}/message`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
        },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error("Failed to send");
      const payload = (await response.json()) as { message?: ChatMessage };
      if (payload.message) {
        setMessages((items) => [...items, payload.message as ChatMessage]);
      }
    } catch {
      setDraft(content);
    }
  }

  return (
    <section className="surface" style={{ borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--ms-line)", padding: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem" }}>Conversation</h1>
        </div>
        <Sparkles size={20} color="#dc2626" aria-hidden />
      </div>
      <div ref={listRef} style={{ display: "grid", gap: ".75rem", maxHeight: "62vh", minHeight: 420, overflowY: "auto", padding: "1rem" }}>
        {messages.map((message, index) => {
          const mine = currentUserId && Number(message.sender_id) === Number(currentUserId);
          return (
            <div key={message.id ?? index} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "min(78%, 620px)",
                  borderRadius: 8,
                  background: mine ? "#dc2626" : "#fff",
                  border: mine ? "1px solid #dc2626" : "1px solid var(--ms-line)",
                  color: mine ? "#fff" : "var(--ms-ink)",
                  padding: ".7rem .85rem",
                  boxShadow: "0 8px 24px rgba(15,23,42,.08)"
                }}
              >
                <p style={{ margin: 0 }}>{message.content}</p>
                <span style={{ display: "block", marginTop: ".35rem", opacity: 0.7, fontSize: ".75rem" }}>
                  {formatTime(message.created_at || message.timestamp) || "Now"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={sendMessage} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: ".65rem", borderTop: "1px solid var(--ms-line)", padding: "1rem" }}>
        <input className="field" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a message..." />
        <button className="btn btn-primary" type="submit" title="Send">
          <Send size={18} aria-hidden />
          Send
        </button>
      </form>
    </section>
  );
}
