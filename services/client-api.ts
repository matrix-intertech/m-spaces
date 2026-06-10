import { backendBaseUrl } from "@/lib/config";

export async function postToBackend<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? payload.message ?? "Request failed");
  }
  return payload as T;
}
