"use client";

import { useState } from "react";

type FollowPartnerButtonProps = {
  partnerId: number;
  initialFollowing?: boolean;
  variant?: "link" | "button";
};

export function FollowPartnerButton({ partnerId, initialFollowing = false, variant = "link" }: FollowPartnerButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isPending, setIsPending] = useState(false);

  async function toggleFollow() {
    if (isPending) return;
    setIsPending(true);
    try {
      const response = await fetch(`/api/partner-follows/${partnerId}`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: { action?: string } };
      if (payload?.data?.action === "followed") setIsFollowing(true);
      if (payload?.data?.action === "unfollowed") setIsFollowing(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={isPending}
      className={variant === "button" ? "btn btn-secondary" : undefined}
      style={{
        ...(variant === "link"
          ? {
              border: 0,
              background: "transparent",
              color: isFollowing ? "var(--ms-ink)" : "#1d4ed8",
              fontWeight: 800,
              fontSize: ".9rem"
            }
          : {}),
        cursor: isPending ? "wait" : "pointer"
      }}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
