"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarCheck,
  ChevronDown,
  Flame,
  Heart,
  Home,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Scale,
  UserCircle,
  X
} from "lucide-react";
import { backendUrl } from "@/lib/config";
import type { User } from "@/types";

const EMPTY_NOTIFICATIONS: Array<Record<string, unknown>> = [];

const navItems = [
  { href: "/search?listingType=sale", label: "Buy" },
  { href: "/search?listingType=rent", label: "Rent" },
  { href: "/search?type=Office", label: "Commercial" },
  { href: "/following", label: "Following" },
  { href: "/partners", label: "Partners" }
];

const buyerServices = [
  { href: "https://mi2005.com", label: "Home Interior Design", external: true },
  { href: "/services/valuation", label: "Valuation" },
  { href: "/services/sell-rent", label: "Sell or Rent Property" }
];

const agentServices = [
  { href: "/list-property", label: "List Property With Us" },
  { href: "/partner-signup", label: "Join as a Partner" }
];

function dashboardPath(role?: string | null) {
  if (role === "admin" || role === "support") return "/admin?tab=overview";
  if (role === "owner") return "/owner";
  if (role === "builder") return "/builder";
  if (role === "broker") return "/broker";
  if (role === "dealer") return "/dealer";
  if (role === "agent") return "/agent";
  if (role === "external_sales") return "/sales";
  if (role === "corporate" || role === "corporate_user") return "/corporate";
  return "/profile";
}

function dashboardLabel(role?: string | null) {
  if (role === "admin" || role === "support") return "Admin Panel";
  if (role === "owner") return "My Properties";
  if (role === "builder") return "Builder Dashboard";
  if (role === "broker") return "Broker Dashboard";
  if (role === "dealer") return "Dealer Dashboard";
  if (role === "agent") return "Agent Dashboard";
  if (role === "external_sales") return "Sales Dashboard";
  if (role === "corporate" || role === "corporate_user") return "Corporate Dashboard";
  return "My Properties";
}

function displayName(user: User) {
  return user.display_name || user.name || user.username || "User";
}

function initials(user: User) {
  return displayName(user).slice(0, 2).toUpperCase();
}

function ServiceAnchor({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  if (external) {
    return (
      <a className="ms-service-link" href={href} target="_blank" rel="noopener noreferrer">
        <span aria-hidden />
        {label}
      </a>
    );
  }

  return (
    <Link className="ms-service-link" href={href}>
      <span aria-hidden />
      {label}
    </Link>
  );
}

function MobileLink({
  href,
  children,
  onClick,
  className = "",
  icon,
  badgeCount = 0
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  icon?: React.ReactNode;
  badgeCount?: number;
}) {
  return (
    <Link href={href} onClick={onClick} className={`ms-mobile-drawer-link ${className}`}>
      {icon ? <span className="ms-mobile-drawer-icon">{icon}</span> : null}
      <span>{children}</span>
      <CountBadge count={badgeCount} inline />
    </Link>
  );
}

function CountBadge({ count, inline = false }: { count?: number; inline?: boolean }) {
  if (!count || count < 1) return null;
  return <span className={inline ? "ms-inline-count-badge" : "ms-count-badge"}>{count > 99 ? "99+" : count}</span>;
}

export function Navbar({
  user,
  chatUnreadCount = 0,
  totalUnreadCount = 0,
  notifications = EMPTY_NOTIFICATIONS
}: {
  user: User | null;
  chatUnreadCount?: number;
  totalUnreadCount?: number;
  notifications?: Array<Record<string, unknown>>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<Array<Record<string, unknown>>>(notifications);
  const [localUnreadCount, setLocalUnreadCount] = useState(totalUnreadCount);
  const [localChatUnreadCount, setLocalChatUnreadCount] = useState(chatUnreadCount);
  const managementHref = user ? dashboardPath(user.role) : "/login";

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileOpen]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    setNotificationItems(notifications);
    setLocalUnreadCount(totalUnreadCount);
    setLocalChatUnreadCount(chatUnreadCount);
  }, [notifications, totalUnreadCount, chatUnreadCount, user?.id]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    let idleId: number | null = null;

    const loadHeaderState = async () => {
      try {
        const [notificationsResponse, conversationsResponse] = await Promise.all([
          fetch(backendUrl("/notifications"), {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch(backendUrl("/chat/conversations"), {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          })
        ]);
        if (!notificationsResponse.ok || !conversationsResponse.ok) return;

        const notificationsPayload = (await notificationsResponse.json()) as {
          notifications?: Array<Record<string, unknown>>;
        };
        const conversationsPayload = (await conversationsResponse.json()) as
          | Array<Record<string, unknown>>
          | { conversations?: Array<Record<string, unknown>> };
        const notificationsList = notificationsPayload.notifications ?? [];
        const conversations = Array.isArray(conversationsPayload)
          ? conversationsPayload
          : conversationsPayload.conversations ?? [];
        const totalUnread = notificationsList.reduce(
          (sum, item) => sum + (item.is_read === false || item.is_read === 0 || item.is_read === "false" ? 1 : 0),
          0
        );
        const chatUnread = conversations.reduce((sum, conversation) => {
          const rawCount = conversation.unread_count;
          const numericCount =
            typeof rawCount === "number"
              ? rawCount
              : typeof rawCount === "string"
                ? Number.parseInt(rawCount, 10)
                : 0;
          return sum + (Number.isFinite(numericCount) ? numericCount : 0);
        }, 0);

        setNotificationItems(notificationsList);
        setLocalUnreadCount(totalUnread);
        setLocalChatUnreadCount(chatUnread);
      } catch {
        // Keep initial shell values if the summary request fails.
      }
    };

    const scheduleRefresh = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => {
          void loadHeaderState();
        }, { timeout: 2500 });
        return;
      }

      timeoutId = globalThis.setTimeout(() => {
        void loadHeaderState();
      }, 1200);
    };

    scheduleRefresh();

    return () => {
      controller.abort();
      if (timeoutId) globalThis.clearTimeout(timeoutId);
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [user]);

  function closeMobileMenu() {
    setMobileOpen(false);
    setMobileServicesOpen(false);
  }

  function notificationText(item: Record<string, unknown>) {
    return String(item.content || item.message || "Notification");
  }

  function notificationLink(item: Record<string, unknown>) {
    const value = item.link;
    return typeof value === "string" && value.trim() ? value : "#";
  }

  function isUnread(item: Record<string, unknown>) {
    return item.is_read === false || item.is_read === 0 || item.is_read === "false";
  }

  async function markAllRead() {
    try {
      await fetch(backendUrl("/notifications/mark-read"), {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      setNotificationItems((current) => current.map((item) => ({ ...item, is_read: true })));
      setLocalUnreadCount(0);
    } catch {
      // Ignore network errors in header action.
    }
  }

  return (
    <>
      <header className="ms-navbar">
        <div className="ms-navbar-row">
          <Link href="/" aria-label="MatrixSpaces home" className="ms-navbar-logo" onClick={closeMobileMenu}>
            <Image src="/assets/logo.png" alt="MatrixSpaces" width={150} height={54} priority style={{ width: 150, height: "auto" }} />
          </Link>

          <nav className="desktop-nav ms-navbar-links" aria-label="Primary navigation">
            {navItems.slice(0, 3).map((item) => (
              <Link key={item.href} className="ms-navbar-link" href={item.href}>
                {item.label}
              </Link>
            ))}
            <div className="ms-desktop-menu">
              <Link className="ms-navbar-link" href="/services" aria-haspopup="true">
                <span>Services</span>
                <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
              </Link>
              <div className="ms-services-dropdown">
                <div className="ms-services-grid">
                  <div>
                    <h3>For Buyers / Owners</h3>
                    <div className="ms-service-list">
                      {buyerServices.map((service) => (
                        <ServiceAnchor key={service.href} {...service} />
                      ))}
                      <ServiceAnchor href={managementHref} label="Property Management" />
                    </div>
                  </div>
                  <div>
                    <h3>For Agents</h3>
                    <div className="ms-service-list ms-service-list-agent">
                      {agentServices.map((service) => (
                        <ServiceAnchor key={service.href} {...service} />
                      ))}
                      <span className="ms-service-disabled">
                        <span aria-hidden />
                        Co-Broking
                        <b>Soon</b>
                      </span>
                    </div>
                  </div>
                </div>
                <Link href="/services" className="ms-services-footer">
                  Explore All Services
                </Link>
              </div>
            </div>
            <Link className="ms-navbar-link" href="/following">Following</Link>
            <Link className="ms-navbar-link" href="/partners">Partners</Link>
          </nav>

          <div className="ms-navbar-actions">
            <Link className="ms-hot-link" href="/requirements">
              <Flame size={15} aria-hidden />
              <span>Hot Requirements</span>
            </Link>
            {user ? (
              <>
                <div className="ms-user-menu">
                  <button className="ms-nav-icon-link" type="button" aria-label="Notifications" aria-haspopup="true">
                    <Bell size={20} aria-hidden />
                    <CountBadge count={localUnreadCount} />
                  </button>
                  <div className="ms-user-dropdown" style={{ width: 320, padding: ".5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", padding: ".3rem .35rem .55rem" }}>
                      <strong style={{ fontSize: ".9rem", color: "#0f172a" }}>Notifications</strong>
                      <button
                        type="button"
                        onClick={markAllRead}
                        disabled={localUnreadCount < 1}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: localUnreadCount > 0 ? "#2563eb" : "#94a3b8",
                          fontWeight: 800,
                          cursor: localUnreadCount > 0 ? "pointer" : "not-allowed",
                          fontSize: ".8rem"
                        }}
                      >
                        Mark all read
                      </button>
                    </div>
                    <div style={{ display: "grid", gap: ".3rem", maxHeight: 290, overflow: "auto", paddingRight: ".2rem" }}>
                      {notificationItems.length ? (
                        notificationItems.slice(0, 12).map((item, index) => (
                          <Link
                            key={`${String(item.id || "n")}-${index}`}
                            href={notificationLink(item)}
                            style={{
                              borderRadius: 9,
                              border: "1px solid #e5e7eb",
                              background: isUnread(item) ? "#eff6ff" : "#ffffff",
                              color: "#1e293b",
                              padding: ".55rem .6rem",
                              fontSize: ".8rem",
                              fontWeight: 700
                            }}
                          >
                            {notificationText(item)}
                          </Link>
                        ))
                      ) : (
                        <span style={{ color: "#64748b", fontSize: ".82rem", padding: ".4rem" }}>No notifications</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ms-user-menu">
                  <button className="ms-user-trigger" type="button" aria-haspopup="true">
                    <span>{displayName(user)}</span>
                    <ChevronDown size={14} aria-hidden />
                  </button>
                  <div className="ms-user-dropdown">
                    <Link href={dashboardPath(user.role)}>{dashboardLabel(user.role)}</Link>
                    <Link href="/messages">
                      <span>Messages</span>
                      <CountBadge count={localChatUnreadCount} inline />
                    </Link>
                    <Link href="/compare">Compare</Link>
                    <Link href="/vault">My Vault</Link>
                    <Link href="/profile">Profile</Link>
                    <Link className="danger" href="/logout">Logout</Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link className="ms-nav-button ms-nav-button-outline" href="/login">
                  Login
                </Link>
                <Link className="ms-nav-button ms-nav-button-outline" href="/login?tab=signup">
                  Sign Up
                </Link>
              </>
            )}
            <Link className="ms-nav-button ms-nav-button-gold" href="/list-property">
              Post Property
            </Link>
          </div>

          <div className="ms-mobile-actions">
            {user ? (
              <>
                <Link className="ms-mobile-icon-button" href="/messages" aria-label="Messages">
                  <MessageCircle size={22} aria-hidden />
                  <CountBadge count={localChatUnreadCount} />
                </Link>
                <button className="ms-mobile-icon-button" type="button" aria-label="Mark all notifications read" onClick={markAllRead}>
                  <Bell size={22} aria-hidden />
                  <CountBadge count={localUnreadCount} />
                </button>
              </>
            ) : null}
            <button
              className="ms-mobile-icon-button"
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X size={24} aria-hidden /> : <Menu size={24} aria-hidden />}
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close mobile menu"
          className={`ms-mobile-overlay ${mobileOpen ? "is-open" : ""}`}
          onClick={closeMobileMenu}
        />

        <aside id="mobile-menu" className={`ms-mobile-drawer ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
          <div className="ms-mobile-drawer-head">
            <Image src="/assets/logo.png" alt="MatrixSpaces" width={120} height={44} style={{ width: 120, height: "auto" }} />
            <button className="ms-mobile-icon-button" type="button" aria-label="Close menu" onClick={closeMobileMenu}>
              <X size={23} aria-hidden />
            </button>
          </div>
          <nav className="ms-mobile-drawer-nav" aria-label="Mobile navigation">
            <MobileLink href="/search?listingType=sale" onClick={closeMobileMenu}>Buy</MobileLink>
            <MobileLink href="/search?listingType=rent" onClick={closeMobileMenu}>Rent</MobileLink>
            <MobileLink href="/search?type=Office" onClick={closeMobileMenu}>Commercial</MobileLink>
            <MobileLink href="/following" onClick={closeMobileMenu}>Following</MobileLink>

            <div className="ms-mobile-services">
              <button type="button" onClick={() => setMobileServicesOpen((open) => !open)} aria-expanded={mobileServicesOpen}>
                <span>Services</span>
                <ChevronDown size={18} className={mobileServicesOpen ? "is-open" : ""} aria-hidden />
              </button>
              {mobileServicesOpen ? (
                <div className="ms-mobile-services-panel">
                  <p>For Buyers / Owners</p>
                  {buyerServices.map((service) => (
                    service.external ? (
                      <a key={service.href} href={service.href} target="_blank" rel="noopener noreferrer" onClick={closeMobileMenu}>
                        {service.label}
                      </a>
                    ) : (
                      <Link key={service.href} href={service.href} onClick={closeMobileMenu}>
                        {service.label}
                      </Link>
                    )
                  ))}
                  <Link href={managementHref} onClick={closeMobileMenu}>Property Management</Link>
                  <p>For Agents</p>
                  {agentServices.map((service) => (
                    <Link key={service.href} href={service.href} onClick={closeMobileMenu}>
                      {service.label}
                    </Link>
                  ))}
                  <span>Co-Broking <b>Soon</b></span>
                  <Link href="/services" onClick={closeMobileMenu} className="ms-mobile-services-all">Explore All Services</Link>
                </div>
              ) : null}
            </div>

            <MobileLink href="/partners" onClick={closeMobileMenu}>Partners</MobileLink>
            <hr />
            {user ? (
              <>
                <MobileLink href="/favorites" onClick={closeMobileMenu} icon={<Heart size={18} aria-hidden />}>Saved Properties</MobileLink>
                <MobileLink href="/messages" onClick={closeMobileMenu} icon={<MessageCircle size={18} aria-hidden />} badgeCount={localChatUnreadCount}>My Chats</MobileLink>
                <MobileLink href="/requirements" onClick={closeMobileMenu} className="hot" icon={<Flame size={18} aria-hidden />}>Hot Requirement</MobileLink>
                <MobileLink href="/list-property" onClick={closeMobileMenu} icon={<Plus size={18} aria-hidden />}>List a Property</MobileLink>
                <MobileLink href={dashboardPath(user.role)} onClick={closeMobileMenu} icon={<Building2 size={18} aria-hidden />}>{dashboardLabel(user.role)}</MobileLink>
                <MobileLink href="/visits" onClick={closeMobileMenu} icon={<CalendarCheck size={18} aria-hidden />}>My Visits</MobileLink>
                <MobileLink href="/vault" onClick={closeMobileMenu} icon={<LockKeyhole size={18} aria-hidden />}>My Vault</MobileLink>
                <MobileLink href="/profile" onClick={closeMobileMenu} icon={<UserCircle size={18} aria-hidden />}>Profile</MobileLink>
              </>
            ) : (
              <div className="ms-mobile-auth-actions">
                <Link href="/login" onClick={closeMobileMenu}>Login</Link>
                <Link href="/login?tab=signup" onClick={closeMobileMenu}>Sign Up</Link>
              </div>
            )}
          </nav>
          {user ? (
            <div className="ms-mobile-user-card">
              <div className="ms-mobile-user-summary">
                <span>{initials(user)}</span>
                <div>
                  <p>{displayName(user)}</p>
                  <small>{user.role || "member"}</small>
                </div>
              </div>
              <Link href="/logout" onClick={closeMobileMenu}>
                <LogOut size={17} aria-hidden />
                Logout
              </Link>
            </div>
          ) : null}
        </aside>
      </header>

      <nav className="ms-bottom-nav" aria-label="Primary mobile navigation">
        <Link href="/">
          <Home size={18} aria-hidden />
          Home
        </Link>
        <Link href="/compare">
          <Scale size={18} aria-hidden />
          Compare
        </Link>
        <Link href="/favorites">
          <Heart size={18} aria-hidden />
          Saved
        </Link>
        <Link href="/list-property" className="ms-bottom-nav-list">
          <Plus size={22} aria-hidden />
          List
        </Link>
        <Link href="/messages">
          <MessageCircle size={18} aria-hidden />
          Chats
          <CountBadge count={localChatUnreadCount} />
        </Link>
        <Link href="/notifications">
          <Bell size={18} aria-hidden />
          Alerts
          <CountBadge count={localUnreadCount} />
        </Link>
        <Link href={user ? "/profile" : "/login"}>
          <UserCircle size={18} aria-hidden />
          {user ? "Profile" : "Login"}
        </Link>
      </nav>
    </>
  );
}
