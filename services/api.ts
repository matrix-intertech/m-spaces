import { headers } from "next/headers";
import { cache } from "react";
import { backendUrl, resolveAbsoluteUrl } from "@/lib/config";
import type { PortfolioPayload } from "@/components/pages/PortfolioPage";
import type { ApiEnvelope, ChatMessage, Conversation, Property, PropertyListResponse, User } from "@/types";
import type { OwnerDashboardProps } from "@/components/pages/OwnerDashboard";

export type DashboardPayload = Record<string, unknown> & {
  user?: User | null;
};

const requestContext = cache(async () => {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const cookie = requestHeaders.get("cookie") ?? "";

  return { cookie, host, protocol };
});

const forwardedCookieHeader = cache(async (): Promise<string> => {
  const { cookie } = await requestContext();
  return cookie;
});

const hasSessionCookie = cache(async (): Promise<boolean> => {
  const cookie = await forwardedCookieHeader();
  return Boolean(cookie && cookie.includes("connect.sid="));
});

export async function backendFetch<T>(
  path: string,
  init: RequestInit & { searchParams?: URLSearchParams } = {}
): Promise<T> {
  const { cookie, host, protocol } = await requestContext();
  const url = new URL(resolveAbsoluteUrl(backendUrl(path), `${protocol}://${host}`));
  if (init.searchParams) {
    init.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  }

  const response = await fetch(url, {
    ...init,
    cache: init.cache ?? "no-store",
    headers: {
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${url.pathname}`);
  }

  return response.json() as Promise<T>;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    if (!(await hasSessionCookie())) {
      return null;
    }

    const payload = await backendFetch<ApiEnvelope<User>>("/api/user");
    return payload.data ?? null;
  } catch {
    return null;
  }
});

export async function getCsrfToken(): Promise<string> {
  try {
    const payload = await backendFetch<{ csrfToken?: string }>("/api/csrf-token");
    return payload.csrfToken ?? "";
  } catch {
    return "";
  }
}

export async function getProperties(
  searchParams?: URLSearchParams,
  init: RequestInit & { searchParams?: URLSearchParams } = {}
): Promise<PropertyListResponse> {
  return backendFetch<PropertyListResponse>("/api/properties", { ...init, searchParams });
}

export async function getUserPropertyCollection(path: "/recommended" | "/favorites" | "/recently-viewed"): Promise<Property[]> {
  try {
    if (!(await hasSessionCookie())) {
      return [];
    }

    const payload = await backendFetch<{ properties: Property[] }>(path);
    return payload.properties ?? [];
  } catch {
    return [];
  }
}

export async function getCompareProperties(): Promise<Property[]> {
  try {
    const payload = await backendFetch<{ properties: Property[] }>("/compare");
    return payload.properties ?? [];
  } catch {
    return [];
  }
}

export async function getPartners(init: RequestInit = {}): Promise<Array<Record<string, unknown>>> {
  try {
    const payload = await backendFetch<{ partners: Array<Record<string, unknown>> }>("/partners", init);
    return payload.partners ?? [];
  } catch {
    return [];
  }
}

export async function getFollowedPartnerIds(): Promise<number[]> {
  try {
    if (!(await hasSessionCookie())) return [];
    const payload = await backendFetch<ApiEnvelope<{ partnerIds: number[] }>>("/api/partner-follows");
    return payload.data?.partnerIds ?? [];
  } catch {
    return [];
  }
}

export async function getRequirements(): Promise<Array<Record<string, unknown>>> {
  try {
    const payload = await backendFetch<{ requirements: Array<Record<string, unknown>> }>("/requirements");
    return payload.requirements ?? [];
  } catch {
    return [];
  }
}

export async function getRequirementsBoard(): Promise<{
  requirements: Array<Record<string, unknown>>;
  myRequirements: Array<Record<string, unknown>>;
}> {
  try {
    const payload = await backendFetch<{
      requirements: Array<Record<string, unknown>>;
      myRequirements?: Array<Record<string, unknown>>;
    }>("/requirements");
    return {
      requirements: payload.requirements ?? [],
      myRequirements: payload.myRequirements ?? []
    };
  } catch {
    return { requirements: [], myRequirements: [] };
  }
}

export async function getVisits(): Promise<Array<Record<string, unknown>>> {
  try {
    if (!(await hasSessionCookie())) return [];
    const payload = await backendFetch<{ visits: Array<Record<string, unknown>> }>("/visits");
    return payload.visits ?? [];
  } catch {
    return [];
  }
}

export async function getNotifications(): Promise<Array<Record<string, unknown>>> {
  try {
    if (!(await hasSessionCookie())) return [];
    const payload = await backendFetch<{ notifications: Array<Record<string, unknown>> }>("/notifications");
    return payload.notifications ?? [];
  } catch {
    return [];
  }
}

export async function getWallet(): Promise<{ withdrawals: Array<Record<string, unknown>>; user?: User | null } | null> {
  try {
    if (!(await hasSessionCookie())) return null;
    return await backendFetch<{ withdrawals: Array<Record<string, unknown>>; user?: User | null }>("/wallet");
  } catch {
    return null;
  }
}

export async function getVault(): Promise<{ documents: Array<Record<string, unknown>>; folders: Array<Record<string, unknown>> } | null> {
  try {
    if (!(await hasSessionCookie())) return null;
    return await backendFetch<{ documents: Array<Record<string, unknown>>; folders: Array<Record<string, unknown>> }>("/vault");
  } catch {
    return null;
  }
}

export async function getProperty(id: string): Promise<Property | null> {
  try {
    const payload = await backendFetch<ApiEnvelope<Property>>(`/api/properties/${id}`);
    return payload.data ?? null;
  } catch {
    return null;
  }
}

export async function getConversations(): Promise<Conversation[]> {
  try {
    if (!(await hasSessionCookie())) return [];
    const payload = await backendFetch<Conversation[] | { conversations: Conversation[] } | ApiEnvelope<{ conversations: Conversation[] }>>("/chat/conversations");
    if (Array.isArray(payload)) return payload;
    if ("conversations" in payload) return payload.conversations ?? [];
    return payload.data?.conversations ?? [];
  } catch {
    return [];
  }
}

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    if (!(await hasSessionCookie())) return [];
    const payload = await backendFetch<ChatMessage[] | { messages: ChatMessage[] } | ApiEnvelope<{ messages: ChatMessage[] }>>(
      `/chat/conversations/${conversationId}/messages`
    );
    const messages = Array.isArray(payload)
      ? payload
      : "messages" in payload
        ? payload.messages ?? []
        : payload.data?.messages ?? [];
    return [...messages].reverse();
  } catch {
    return [];
  }
}

export async function getPortfolio(username: string): Promise<PortfolioPayload | null> {
  try {
    const payload = await backendFetch<ApiEnvelope<PortfolioPayload>>(`/api/portfolio/${username}`);
    return payload.data ?? null;
  } catch {
    return null;
  }
}

export async function getOwnerDashboard(): Promise<OwnerDashboardProps | null> {
  try {
    if (!(await hasSessionCookie())) return null;
    return await backendFetch<OwnerDashboardProps>("/owner");
  } catch {
    return null;
  }
}

export async function getDashboardPayload(
  route: "admin" | "builder" | "broker" | "sales" | "external-sales" | "corporate" | "profile" | "edit-profile" | "complete-profile",
  queryParams?: Record<string, string | string[] | undefined>
): Promise<DashboardPayload | null> {
  try {
    if (!(await hasSessionCookie())) return null;
    const normalizedRoute = route === "external-sales" ? "sales" : route;
    const searchParams = new URLSearchParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((entry) => {
            if (entry) searchParams.append(key, entry);
          });
          return;
        }
        if (value) searchParams.set(key, value);
      });
    }
    return await backendFetch<DashboardPayload>(`/${normalizedRoute}`, { searchParams });
  } catch {
    return null;
  }
}
