"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Search, Settings, CircleHelp, CalendarDays, Send, X, MoreVertical, Trash2 } from "lucide-react";
import { getClientCsrfToken } from "@/lib/csrf-client";
import { backendBaseUrl, s3BaseUrl } from "@/lib/config";
import { formatTime } from "@/lib/format";
import type { ChatMessage, Conversation, Property, User } from "@/types";

type SectionType = "management" | "purchasing";

function asArrayPhotos(photos: Property["photos"] | Conversation["photos"]): string[] {
  if (Array.isArray(photos)) return photos.filter(Boolean) as string[];
  if (typeof photos !== "string" || !photos.trim()) return [];
  try {
    const parsed = JSON.parse(photos);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [photos];
  } catch {
    return [photos];
  }
}

function toAssetUrl(raw?: string | null): string {
  if (!raw) return "/assets/property-placeholder.png";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${s3BaseUrl}/${String(raw).replace(/^\/+/, "")}`;
}

function getCounterpartyLabel(conversation: Conversation, currentUserId: number): string {
  if (Number(conversation.buyer_id) === currentUserId) {
    return conversation.manager_username || "User";
  }
  if (Number(conversation.owner_id) === currentUserId) {
    return conversation.buyer_username || "User";
  }
  return "User";
}

export function MessagingWorkspace({
  user,
  conversations,
  initialConversationId,
  initialMessages,
  initialProperty,
  initialSection
}: {
  user: User;
  conversations: Conversation[];
  initialConversationId: number | null;
  initialMessages: ChatMessage[];
  initialProperty: Property | null;
  initialSection: SectionType;
}) {
  const [section, setSection] = useState<SectionType>(initialSection);
  const [conversationList, setConversationList] = useState<Conversation[]>(conversations);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [activeProperty, setActiveProperty] = useState<Property | null>(initialProperty);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [openMenuConversationId, setOpenMenuConversationId] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string>("");
  const [scheduleForm, setScheduleForm] = useState({
    preferredDate: "",
    preferredTime: "",
    contactNumber: String(user.phone ?? ""),
    message: ""
  });
  const currentUserId = Number(user.id);
  const fetchSeq = useRef(0);

  const sectionConversations = useMemo(() => {
    const filtered = conversationList.filter((conversation) => {
      const isBuyerSide = Number(conversation.buyer_id) === currentUserId;
      if (section === "purchasing") return isBuyerSide;
      return !isBuyerSide;
    });
    if (!query.trim()) return filtered;
    const needle = query.toLowerCase();
    return filtered.filter((conversation) => {
      const name = getCounterpartyLabel(conversation, currentUserId).toLowerCase();
      const propertyTitle = String(conversation.property_title ?? "").toLowerCase();
      return name.includes(needle) || propertyTitle.includes(needle);
    });
  }, [conversationList, section, query, currentUserId]);

  useEffect(() => {
    if (!sectionConversations.length) {
      setActiveConversationId(null);
      return;
    }
    const exists = sectionConversations.some((conversation) => Number(conversation.id) === Number(activeConversationId));
    if (!exists) setActiveConversationId(Number(sectionConversations[0].id));
  }, [sectionConversations, activeConversationId]);

  const activeConversation = sectionConversations.find((conversation) => Number(conversation.id) === Number(activeConversationId)) || null;
  const activeConversationIdSafe = activeConversation ? Number(activeConversation.id) : null;
  const activeTitle = activeConversation ? getCounterpartyLabel(activeConversation, currentUserId) : "No conversation selected";
  const activeSubtitle = activeConversation?.property_title || "Select a thread to view messages";
  const suggestionChips = ["Sure, Tuesday at 2 PM?", "I'll send the contract", "Please share more details"];

  useEffect(() => {
    if (!activeConversationIdSafe) {
      setMessages([]);
      setActiveProperty(null);
      return;
    }

    const seq = ++fetchSeq.current;
    const aborter = new AbortController();

    async function loadMessages(markRead = false) {
      const messageResponse = await fetch(`${backendBaseUrl}/chat/conversations/${activeConversationIdSafe}/messages`, {
        credentials: "include",
        cache: "no-store",
        signal: aborter.signal
      });
      if (!messageResponse.ok || seq !== fetchSeq.current) return;

      const messagePayload = (await messageResponse.json()) as { messages?: ChatMessage[] };
      const loaded = [...(messagePayload.messages ?? [])].reverse();
      if (seq !== fetchSeq.current) return;
      setMessages(loaded);

      if (!markRead) return;
      const csrfToken = await getClientCsrfToken().catch(() => "");
      await fetch(`${backendBaseUrl}/chat/conversations/${activeConversationIdSafe}/read`, {
        method: "PATCH",
        credentials: "include",
        signal: aborter.signal,
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined
      }).catch(() => undefined);
    }

    void (async () => {
      const propertyPromise = activeConversation?.property_id
        ? fetch(`${backendBaseUrl}/api/properties/${activeConversation.property_id}`, {
            credentials: "include",
            cache: "no-store",
            signal: aborter.signal
          })
        : Promise.resolve(null);

      const [, propertyResponse] = await Promise.all([loadMessages(true), propertyPromise]);
      if (seq !== fetchSeq.current) return;

      if (propertyResponse && propertyResponse.ok) {
        const propertyPayload = (await propertyResponse.json()) as { data?: Property };
        if (seq !== fetchSeq.current) return;
        setActiveProperty(propertyPayload.data ?? null);
      } else {
        setActiveProperty(null);
      }
    })().catch(() => {});

    const pollId = window.setInterval(() => {
      void loadMessages(false).catch(() => undefined);
    }, 5000);

    return () => {
      aborter.abort();
      window.clearInterval(pollId);
    };
  }, [activeConversationIdSafe, activeConversation?.property_id]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !activeConversationIdSafe) return;
    setDraft("");
    try {
      const csrfToken = await getClientCsrfToken();
      const response = await fetch(`${backendBaseUrl}/chat/conversations/${activeConversationIdSafe}/message`, {
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

  async function submitScheduleViewing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversation?.property_id || scheduleLoading) return;
    setScheduleLoading(true);
    setScheduleStatus("");
    try {
      const payload = new URLSearchParams();
      payload.set("propertyId", String(activeConversation.property_id));
      if (scheduleForm.preferredDate.trim()) payload.set("preferredDate", scheduleForm.preferredDate.trim());
      if (scheduleForm.preferredTime.trim()) payload.set("preferredTime", scheduleForm.preferredTime.trim());
      if (scheduleForm.contactNumber.trim()) payload.set("contactNumber", scheduleForm.contactNumber.trim());
      if (scheduleForm.message.trim()) payload.set("message", scheduleForm.message.trim());
      const csrfToken = await getClientCsrfToken();

      const response = await fetch(`${backendBaseUrl}/visits/schedule`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
        },
        body: payload.toString()
      });
      if (!response.ok) throw new Error("Failed to schedule");
      setScheduleStatus("Visit request sent successfully.");
      setTimeout(() => setScheduleOpen(false), 850);
    } catch {
      setScheduleStatus("Could not schedule right now. Please try again.");
    } finally {
      setScheduleLoading(false);
    }
  }

  async function deleteConversation(conversationId: number) {
    try {
      const csrfToken = await getClientCsrfToken();
      const response = await fetch(`${backendBaseUrl}/chat/conversations/${conversationId}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined
      });
      if (!response.ok) throw new Error("Failed");
      setConversationList((items) => items.filter((item) => Number(item.id) !== Number(conversationId)));
      setOpenMenuConversationId(null);
      if (Number(activeConversationId) === Number(conversationId)) {
        setActiveConversationId(null);
      }
    } catch {
      setOpenMenuConversationId(null);
    }
  }

  const propertyPhotos = asArrayPhotos(activeProperty?.photos ?? activeConversation?.photos);
  const heroPhoto = toAssetUrl(propertyPhotos[0]);
  const priceValue = activeProperty?.final_price ?? activeProperty?.price ?? activeProperty?.rent ?? activeConversation?.final_price ?? activeConversation?.price ?? activeConversation?.rent;
  const locationValue = [activeProperty?.locality ?? activeConversation?.locality, activeProperty?.city ?? activeConversation?.city].filter(Boolean).join(", ");
  const shellBg = "var(--ms-bg)";
  const panelBg = "var(--ms-glass)";
  const border = "var(--ms-line)";
  const asideBg = "color-mix(in srgb, var(--ms-bg) 90%, var(--ms-brand) 10%)";
  const text = "var(--ms-ink)";
  const muted = "var(--ms-muted)";
  const accent = "var(--ms-gold)";

  return (
    <div style={{ background: shellBg, color: text, minHeight: "calc(100vh - 90px)", padding: "14px" }}>
      <div style={{ border: `1px solid ${border}`, borderRadius: 16, overflow: "hidden", background: panelBg }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: "14px", borderBottom: `1px solid ${border}` }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${border}`, borderRadius: 10, padding: "0 12px", minHeight: 50 }}>
            <Search size={20} color={muted} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search across all communications..."
              style={{ background: "transparent", border: "none", outline: "none", width: "100%", color: text }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-secondary" style={{ minHeight: 42 }}><Bell size={18} /></button>
            <button className="btn btn-secondary" style={{ minHeight: 42 }}><Settings size={18} /></button>
            <button className="btn btn-secondary" style={{ minHeight: 42 }}><CircleHelp size={18} /></button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0,1fr) 360px", minHeight: "74vh" }}>
          <aside style={{ borderRight: `1px solid ${border}`, background: asideBg }}>
            <div style={{ padding: "12px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 26, color: accent }}>Messages</strong>
              <span style={{ background: "#dc267f", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
                {sectionConversations.reduce((sum, c) => sum + Number(c.unread_count ?? 0), 0)} UNREAD
              </span>
            </div>

            <div style={{ padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, border: `1px solid ${border}`, borderRadius: 10, padding: 4 }}>
                <button
                  className="btn"
                  style={{ minHeight: 38, background: section === "management" ? "#f72585" : "transparent", color: section === "management" ? "#fff" : muted }}
                  onClick={() => setSection("management")}
                  type="button"
                >
                  Management
                </button>
                <button
                  className="btn"
                  style={{ minHeight: 38, background: section === "purchasing" ? "#f72585" : "transparent", color: section === "purchasing" ? "#fff" : muted }}
                  onClick={() => setSection("purchasing")}
                  type="button"
                >
                  Purchasing
                </button>
              </div>
            </div>

            <div>
              {sectionConversations.map((conversation) => {
                const isActive = Number(conversation.id) === activeConversationIdSafe;
                const name = getCounterpartyLabel(conversation, currentUserId);
                const preview = conversation.last_message || "No messages yet";
                return (
                  <div key={conversation.id} style={{ position: "relative", borderBottom: `1px solid ${border}` }}>
                    <button
                      type="button"
                      onClick={() => setActiveConversationId(Number(conversation.id))}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: isActive ? "rgba(247,37,133,0.12)" : "transparent",
                        border: "none",
                        borderLeft: isActive ? "3px solid #f6d35f" : "3px solid transparent",
                        color: text,
                        padding: "12px 44px 12px 14px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <strong>{name}</strong>
                        <span style={{ color: muted, fontSize: 12 }}>{formatTime(conversation.last_message_at || conversation.updated_at) || ""}</span>
                      </div>
                      <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>{conversation.property_title || "Property"}</div>
                      <div style={{ color: muted, fontSize: 13, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{preview}</div>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenuConversationId((prev) => (prev === Number(conversation.id) ? null : Number(conversation.id)));
                      }}
                      style={{ position: "absolute", top: 10, right: 8, minHeight: 30, minWidth: 30, padding: 0 }}
                      aria-label="Chat actions"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenuConversationId === Number(conversation.id) ? (
                      <div style={{ position: "absolute", top: 42, right: 8, zIndex: 4, border: `1px solid ${border}`, background: panelBg, borderRadius: 10, overflow: "hidden" }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteConversation(Number(conversation.id));
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: "#dc2626", padding: "10px 12px", cursor: "pointer", width: "100%", textAlign: "left" }}
                        >
                          <Trash2 size={14} />
                          Delete chat
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!sectionConversations.length ? <p style={{ padding: "14px", color: muted }}>No conversations yet.</p> : null}
            </div>
          </aside>

          <section style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minWidth: 0 }}>
            {activeConversation ? (
              <>
                <div style={{ borderBottom: `1px solid ${border}`, padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, color: text }}>{activeTitle}</h2>
                    <div style={{ color: muted }}>Active regarding <strong>{activeSubtitle}</strong></div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn" style={{ minHeight: 44, background: "#f2a9c3", color: "#421222" }} type="button" onClick={() => setScheduleOpen(true)}>
                      <CalendarDays size={17} />
                      Schedule Viewing
                    </button>
                  </div>
                </div>

                <div style={{ padding: "16px", overflowY: "auto", maxHeight: "calc(74vh - 210px)", display: "flex", flexDirection: "column", gap: 14 }}>
                  {messages.map((message, index) => {
                    const mine = Number(message.sender_id) === currentUserId;
                    return (
                      <div key={message.id ?? `${index}-${message.created_at ?? ""}`} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                        <div
                          style={{
                            maxWidth: "70%",
                            borderRadius: 16,
                            background: mine ? "rgba(29, 78, 216, 0.2)" : "rgba(148, 163, 184, 0.16)",
                            border: `1px solid ${mine ? "rgba(59, 130, 246, 0.35)" : "rgba(148, 163, 184, 0.35)"}`,
                            color: text,
                            padding: "14px"
                          }}
                        >
                          <div>{message.content}</div>
                          <div style={{ marginTop: 8, fontSize: 12, color: muted }}>
                            {formatTime(message.created_at || message.timestamp) || "Now"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ borderTop: `1px solid ${border}`, padding: "12px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    {suggestionChips.map((chip) => (
                      <button key={chip} type="button" className="btn btn-secondary" style={{ minHeight: 34, fontSize: 13 }} onClick={() => setDraft(chip)}>
                        {chip}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={sendMessage} style={{ border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={`Type your response to ${activeTitle}...`}
                      style={{ width: "100%", height: 50, border: "none", outline: "none", background: "transparent", color: text, padding: "0 12px 0 12px" }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 10px 8px", marginTop: -44 }}>
                      <button className="btn" style={{ minHeight: 42, minWidth: 160, background: "#f6d35f", color: "#2a1f06" }} type="submit" disabled={!activeConversationIdSafe || !draft.trim()}>
                        <Send size={17} />
                        Send Message
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", placeItems: "center", height: "100%", minHeight: 420, color: muted, padding: 24, textAlign: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 8px", color: text }}>No chat history yet</h3>
                  <p style={{ margin: 0 }}>Start a conversation from a property page to see chats here.</p>
                </div>
              </div>
            )}
          </section>

          <aside style={{ borderLeft: `1px solid ${border}`, padding: "14px", background: asideBg }}>
            <p style={{ margin: "0 0 8px", color: muted, fontSize: 12, letterSpacing: ".12em" }}>LINKED PROPERTY</p>
            {activeConversation ? (
              <>
                <div style={{ border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", background: "color-mix(in srgb, var(--ms-bg) 78%, white 22%)" }}>
                  <img src={heroPhoto} alt={activeConversation?.property_title || "Property"} style={{ width: "100%", height: 180, objectFit: "cover" }} />
                  <div style={{ padding: 14 }}>
                    <h3 style={{ margin: "0 0 6px", color: text }}>{activeConversation?.property_title || "Property"}</h3>
                    <div style={{ color: accent, fontSize: 32, fontWeight: 700 }}>{priceValue ? `₹${Number(priceValue).toLocaleString("en-IN")}` : "Price on request"}</div>
                    <div style={{ color: muted, marginTop: 6 }}>{locationValue || "Location unavailable"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 16, border: `1px solid ${border}`, borderRadius: 12, padding: 14 }}>
                  <p style={{ margin: "0 0 8px", color: muted, fontSize: 12, letterSpacing: ".12em" }}>LEAD INSIGHTS</p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: accent, fontWeight: 700 }}>
                    <span>Lead Score</span>
                    <span>{Math.min(95, 55 + messages.length * 4)}%</span>
                  </div>
                  <div style={{ marginTop: 8, background: "#0b0906", borderRadius: 999, height: 10 }}>
                    <div style={{ width: `${Math.min(95, 55 + messages.length * 4)}%`, height: "100%", borderRadius: 999, background: "#f6d35f" }} />
                  </div>
                  <div style={{ marginTop: 12, color: muted }}>
                    Source: {section === "management" ? "Managed listing" : "Inbound lead"}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ border: `1px dashed ${border}`, borderRadius: 12, padding: 14, color: muted }}>No linked property yet.</div>
            )}
          </aside>
        </div>
      </div>
      {scheduleOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2, 6, 23, 0.6)", display: "grid", placeItems: "center", zIndex: 70, padding: 14 }}>
          <div className="surface" style={{ width: "min(520px, 100%)", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Schedule Viewing</h3>
              <button className="btn btn-secondary" style={{ minHeight: 36, minWidth: 36, padding: 0 }} type="button" onClick={() => setScheduleOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={submitScheduleViewing} style={{ display: "grid", gap: 10 }}>
              <input className="field" type="date" value={scheduleForm.preferredDate} onChange={(event) => setScheduleForm((prev) => ({ ...prev, preferredDate: event.target.value }))} />
              <input className="field" type="time" value={scheduleForm.preferredTime} onChange={(event) => setScheduleForm((prev) => ({ ...prev, preferredTime: event.target.value }))} />
              <input className="field" placeholder="Contact number" value={scheduleForm.contactNumber} onChange={(event) => setScheduleForm((prev) => ({ ...prev, contactNumber: event.target.value }))} />
              <textarea className="field" style={{ minHeight: 84, borderRadius: 14 }} placeholder="Message (optional)" value={scheduleForm.message} onChange={(event) => setScheduleForm((prev) => ({ ...prev, message: event.target.value }))} />
              {scheduleStatus ? <p style={{ margin: 0, fontSize: 13, color: "var(--ms-muted)" }}>{scheduleStatus}</p> : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-secondary" type="button" onClick={() => setScheduleOpen(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={scheduleLoading || !activeConversation?.property_id}>
                  {scheduleLoading ? "Submitting..." : "Request Visit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
