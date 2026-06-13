"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, Phone } from "lucide-react";
import { backendBaseUrl } from "@/lib/config";
import { TurnstileSignupField } from "@/components/auth/TurnstileSignupField";
import { getClientCsrfToken } from "@/lib/csrf-client";

type AuthTab = "login" | "signup";
type LoginMode = "password" | "otp" | "whatsapp";
type AccountType = { role: string; label: string; count?: number };
type AuthPayload = {
  success?: boolean;
  requires2FA?: boolean;
  redirect?: string;
  message?: string;
  requiresAccountType?: boolean;
  accountTypes?: AccountType[];
};

function queryMessage(logout: string | null, message: string | null) {
  if (message) return message;
  if (logout === "success") return "You have been logged out successfully.";
  if (logout === "timeout") return "Your session has expired due to inactivity. Please log in again.";
  return null;
}

function strengthFor(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z\d]/.test(password)) score += 1;

  if (!password) return { width: 0, label: "", color: "#ef4444" };
  if (password.length < 8) return { width: 10, label: "Too short", color: "#f87171" };
  if (score <= 1) return { width: 25, label: "Weak", color: "#ef4444" };
  if (score === 2) return { width: 50, label: "Fair", color: "#eab308" };
  if (score === 3) return { width: 75, label: "Good", color: "#3b82f6" };
  return { width: 100, label: "Strong", color: "#22c55e" };
}

function normalizeRedirect(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url || "/";
  }
}

function navigateAfterAuth(url: string) {
  window.location.assign(url || "/");
}

function roleRedirectPath(roleValue: unknown) {
  const role = String(roleValue || "").toLowerCase();
  if (role === "admin" || role === "support") return "/admin?tab=overview";
  if (role === "builder") return "/builder";
  if (role === "broker") return "/broker";
  if (role === "dealer") return "/dealer";
  if (role === "agent") return "/agent";
  if (role === "external_sales") return "/sales";
  if (role === "corporate" || role === "corporate_user") return "/corporate";
  return "/";
}

async function fetchCurrentUserClient(): Promise<{ role?: string } | null> {
  const response = await fetch(`${backendBaseUrl}/api/user`, {
    credentials: "include",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as
    | { data?: { role?: string } | null; user?: { role?: string } | null; role?: string }
    | null;

  return payload?.data ?? payload?.user ?? (payload?.role ? { role: payload.role } : null);
}

async function waitForAuthenticatedSession(preferredRedirect: string, fallbackRedirect: string) {
  const attempts = [150, 300, 450, 700, 1000];

  for (const delayMs of attempts) {
    const user = await fetchCurrentUserClient().catch(() => null);
    if (user) {
      return preferredRedirect || fallbackRedirect || roleRedirectPath(user.role);
    }

    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  return preferredRedirect || fallbackRedirect || "/";
}

async function postAuth(path: string, body: Record<string, unknown>): Promise<{ payload: AuthPayload; redirectedTo?: string }> {
  const csrfToken = await getClientCsrfToken();
  const response = await fetch(`${backendBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {})
    },
    body: JSON.stringify(body)
  });
  const rawText = await response.text();
  let payload: AuthPayload & { error?: string } = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as AuthPayload & { error?: string };
    } catch {
      const trimmed = rawText.trim();
      payload = {
        error: /<!doctype html|<html/i.test(trimmed)
          ? undefined
          : trimmed || undefined
      };
    }
  }
  if (!response.ok) {
    const fallbackMessage = response.status
      ? response.status >= 500
        ? `Server error (${response.status})`
        : `Request failed (${response.status})`
      : "Request failed";
    throw new Error(payload.error ?? payload.message ?? fallbackMessage);
  }
  return { payload, redirectedTo: response.redirected ? normalizeRedirect(response.url) : undefined };
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams?.get("redirect") ?? "";
  const tabParam = searchParams?.get("tab") ?? "login";
  const refCode = searchParams?.get("ref") ?? "";
  const [authTab, setAuthTab] = useState<AuthTab>(tabParam === "signup" || tabParam === "owner" || tabParam === "tenant" ? "signup" : "login");
  const [loginMode, setLoginMode] = useState<LoginMode>(tabParam === "otp" || tabParam === "whatsapp" ? tabParam : "password");
  const [error, setError] = useState<string | null>(searchParams?.get("error") ?? null);
  const [message, setMessage] = useState<string | null>(queryMessage(searchParams?.get("logout") ?? null, searchParams?.get("message") ?? null));
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupPassword, setSignupPassword] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [whatsappOtpSent, setWhatsappOtpSent] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [whatsappOtp, setWhatsappOtp] = useState("");
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [emailResendSeconds, setEmailResendSeconds] = useState(0);
  const [whatsappResendSeconds, setWhatsappResendSeconds] = useState(0);
  const [signupPhoneError, setSignupPhoneError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const strength = useMemo(() => strengthFor(signupPassword), [signupPassword]);

  useEffect(() => {
    void getClientCsrfToken().then(setCsrfToken).catch(() => {});
  }, []);

  useEffect(() => {
    if (emailResendSeconds <= 0) return;
    const timer = window.setTimeout(() => setEmailResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [emailResendSeconds]);

  useEffect(() => {
    if (whatsappResendSeconds <= 0) return;
    const timer = window.setTimeout(() => setWhatsappResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [whatsappResendSeconds]);

  useEffect(() => {
    if (!requestedRedirect) return;

    let active = true;
    void fetchCurrentUserClient()
      .then((user) => {
        if (!active || !user) return;
        navigateAfterAuth(requestedRedirect || roleRedirectPath(user.role));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [requestedRedirect]);

  function showLoginMode(mode: LoginMode) {
    setAuthTab("login");
    setLoginMode(mode);
    setError(null);
    setMessage(null);
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { payload, redirectedTo } = await postAuth("/login", {
        email: formData.get("email"),
        password: formData.get("password"),
        remember: formData.get("remember") === "on",
        redirect: requestedRedirect
      });
      if (payload.requires2FA) router.push("/login/2fa");
      else {
        const nextUrl = await waitForAuthenticatedSession(
          requestedRedirect,
          redirectedTo || payload.redirect || "/"
        );
        navigateAfterAuth(nextUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestEmailOtp(isResend = false) {
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await postAuth("/send-otp", { email: emailInput });
      setEmailOtpSent(true);
      setEmailResendSeconds(30);
      setMessage(isResend ? "OTP resent successfully." : "OTP sent successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmailOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (emailOtp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { payload } = await postAuth("/login/otp", {
        email: emailInput,
        otp: emailOtp,
        referral_code: formData.get("referral_code") || refCode
      });
      navigateAfterAuth(payload.redirect || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function requestWhatsAppOtp(isResend = false) {
    if (phoneInput.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await postAuth("/send-whatsapp-otp", { phone: phoneInput });
      setWhatsappOtpSent(true);
      setWhatsappResendSeconds(30);
      setMessage(isResend ? "WhatsApp OTP resent successfully." : "WhatsApp OTP sent successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send WhatsApp OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyWhatsAppOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (whatsappOtp.length !== 6) {
      setError("Please enter the 6-digit WhatsApp OTP.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const role = accountTypes.length ? formData.get("role") : "";
      const { payload } = await postAuth("/login/whatsapp-otp", {
        phone: phoneInput,
        otp: whatsappOtp,
        referral_code: formData.get("referral_code") || refCode,
        role
      });
      if (payload.requiresAccountType) {
        setAccountTypes(payload.accountTypes ?? []);
        setError("Please select the account type for this phone number.");
      } else {
        navigateAfterAuth(payload.redirect || "/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid WhatsApp OTP");
    } finally {
      setLoading(false);
    }
  }

  async function checkSignupPhoneAvailability(phoneValue: string) {
    const trimmed = phoneValue.trim();
    if (!trimmed) {
      setSignupPhoneError("");
      return;
    }
    try {
      const csrf = await getClientCsrfToken();
      const response = await fetch(`${backendBaseUrl}/signup/check-availability`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrf ? { "x-csrf-token": csrf } : {})
        },
        body: JSON.stringify({ phone: trimmed })
      });
      const payload = (await response.json().catch(() => ({}))) as { errors?: { phone?: string } };
      setSignupPhoneError(payload?.errors?.phone ?? "");
    } catch {
      setSignupPhoneError("");
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 448, overflow: "hidden", border: "1px solid #e5e7eb", borderRadius: 12, background: "white", boxShadow: "0 22px 60px rgba(15, 23, 42, 0.14)" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
        {(["login", "signup"] as AuthTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setAuthTab(tab)}
            style={{
              flex: 1,
              border: 0,
              borderBottom: `2px solid ${authTab === tab ? "#dc2626" : "transparent"}`,
              background: authTab === tab ? "white" : "transparent",
              color: authTab === tab ? "#dc2626" : "#6b7280",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 800,
              padding: ".85rem"
            }}
          >
            {tab === "login" ? "Login" : "Sign Up"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: "1rem", padding: "1.25rem" }}>
        {error ? <div style={{ border: "1px solid #fecaca", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 14, fontWeight: 800, padding: ".75rem" }}>{error}</div> : null}
        {message ? <div style={{ border: "1px solid #bbf7d0", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontSize: 14, fontWeight: 800, padding: ".75rem" }}>{message}</div> : null}
        {refCode ? <div style={{ border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", color: "#1d4ed8", fontSize: 14, fontWeight: 800, padding: ".75rem" }}>Referral code applied!</div> : null}

        {authTab === "login" ? (
          <>
            {loginMode === "password" ? (
              <form onSubmit={(event) => void handlePasswordLogin(event)} style={{ display: "grid", gap: "1rem" }}>
                <label style={{ display: "grid", gap: ".35rem" }}>
                  <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Email or Account Number</span>
                  <input className="field" name="email" autoComplete="username" required />
                </label>
                <label style={{ display: "grid", gap: ".35rem" }}>
                  <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Password</span>
                  <span style={{ position: "relative", display: "block" }}>
                    <input className="field" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required style={{ paddingRight: 42 }} />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "#6b7280", cursor: "pointer" }}>
                      {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                    </button>
                  </span>
                </label>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".75rem" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", color: "#4b5563", fontSize: 12, fontWeight: 800 }}>
                    <input name="remember" type="checkbox" />
                    Remember me
                  </label>
                  <Link href="/forgot-password" style={{ color: "#dc2626", fontSize: 12, fontWeight: 800 }}>Forgot Password?</Link>
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", borderRadius: 6 }}>
                  <KeyRound size={18} aria-hidden />
                  {loading ? "Signing in..." : "Login"}
                </button>
                <button type="button" onClick={() => showLoginMode("otp")} style={{ border: "1px solid transparent", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", cursor: "pointer", fontSize: 14, fontWeight: 800, padding: ".75rem" }}>
                  Login / Sign up with OTP
                </button>
                <button type="button" onClick={() => showLoginMode("whatsapp")} style={{ border: "1px solid transparent", borderRadius: 6, background: "rgba(37, 211, 102, .1)", color: "#16a34a", cursor: "pointer", fontSize: 14, fontWeight: 800, padding: ".75rem" }}>
                  Login / Sign up with WhatsApp
                </button>
              </form>
            ) : null}

            {loginMode === "otp" ? (
              <form onSubmit={(event) => void verifyEmailOtp(event)} style={{ display: "grid", gap: "1rem" }}>
                <label style={{ display: "grid", gap: ".35rem" }}>
                  <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Email Address</span>
                  <input className="field" type="email" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} readOnly={emailOtpSent} required />
                </label>
                {emailOtpSent ? (
                  <>
                    <label style={{ display: "grid", gap: ".35rem" }}>
                      <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Enter 6-digit OTP</span>
                      <input className="field" value={emailOtp} onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="------" style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: ".5em", textAlign: "center" }} />
                    </label>
                    <label style={{ display: "grid", gap: ".35rem" }}>
                      <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Referral Code (Optional, for new users)</span>
                      <input className="field" name="referral_code" defaultValue={refCode} />
                    </label>
                  </>
                ) : null}
                {emailOtpSent ? (
                  <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", borderRadius: 6 }}>{loading ? "Verifying..." : "Verify & Login"}</button>
                ) : (
                  <button type="button" onClick={() => requestEmailOtp()} disabled={loading} style={{ border: 0, borderRadius: 6, background: "#111827", color: "white", cursor: "pointer", fontWeight: 800, padding: ".85rem" }}>{loading ? "Sending..." : "Send OTP"}</button>
                )}
                {emailOtpSent ? <button type="button" onClick={() => requestEmailOtp(true)} disabled={loading || emailResendSeconds > 0} style={{ border: 0, background: "transparent", color: emailResendSeconds > 0 ? "#9ca3af" : "#dc2626", cursor: emailResendSeconds > 0 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 800 }}>{emailResendSeconds > 0 ? `Resend in ${emailResendSeconds}s` : "Resend OTP"}</button> : null}
                <button type="button" onClick={() => showLoginMode("password")} style={{ border: "1px solid #e5e7eb", borderRadius: 6, background: "#f9fafb", color: "#374151", cursor: "pointer", fontSize: 14, fontWeight: 800, padding: ".75rem" }}>Login with Password instead</button>
              </form>
            ) : null}

            {loginMode === "whatsapp" ? (
              <form onSubmit={(event) => void verifyWhatsAppOtp(event)} style={{ display: "grid", gap: "1rem" }}>
                <label style={{ display: "grid", gap: ".35rem" }}>
                  <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Phone Number</span>
                  <input className="field" type="tel" value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} readOnly={whatsappOtpSent} placeholder="e.g. 9876543210" required />
                </label>
                {whatsappOtpSent ? (
                  <>
                    <label style={{ display: "grid", gap: ".35rem" }}>
                      <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Enter 6-digit WhatsApp OTP</span>
                      <input className="field" value={whatsappOtp} onChange={(event) => setWhatsappOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="------" style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: ".5em", textAlign: "center" }} />
                    </label>
                    <label style={{ display: "grid", gap: ".35rem" }}>
                      <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Referral Code (Optional, for new users)</span>
                      <input className="field" name="referral_code" defaultValue={refCode} />
                    </label>
                    {accountTypes.length ? (
                      <label style={{ display: "grid", gap: ".35rem" }}>
                        <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Select Account Type</span>
                        <select className="field" name="role" defaultValue={accountTypes[0]?.role ?? ""}>
                          {accountTypes.map((accountType) => (
                            <option key={accountType.role} value={accountType.role}>{accountType.count && accountType.count > 1 ? `${accountType.label} (${accountType.count} accounts)` : accountType.label}</option>
                          ))}
                        </select>
                        <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>This phone number is linked to more than one account.</span>
                      </label>
                    ) : null}
                  </>
                ) : null}
                {whatsappOtpSent ? (
                  <button type="submit" disabled={loading} style={{ border: 0, borderRadius: 6, background: "#25D366", color: "white", cursor: "pointer", fontWeight: 800, padding: ".85rem" }}>{loading ? "Verifying..." : "Verify & Login"}</button>
                ) : (
                  <button type="button" onClick={() => requestWhatsAppOtp()} disabled={loading} style={{ border: 0, borderRadius: 6, background: "#25D366", color: "white", cursor: "pointer", fontWeight: 800, padding: ".85rem" }}>{loading ? "Sending..." : "Send WhatsApp OTP"}</button>
                )}
                {whatsappOtpSent ? <button type="button" onClick={() => requestWhatsAppOtp(true)} disabled={loading || whatsappResendSeconds > 0} style={{ border: 0, background: "transparent", color: whatsappResendSeconds > 0 ? "#9ca3af" : "#16a34a", cursor: whatsappResendSeconds > 0 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 800 }}>{whatsappResendSeconds > 0 ? `Resend in ${whatsappResendSeconds}s` : "Resend OTP"}</button> : null}
                <button type="button" onClick={() => showLoginMode("password")} style={{ border: "1px solid #e5e7eb", borderRadius: 6, background: "#f9fafb", color: "#374151", cursor: "pointer", fontSize: 14, fontWeight: 800, padding: ".75rem" }}>Login with Password instead</button>
              </form>
            ) : null}

            <div style={{ position: "relative", margin: ".25rem 0" }}>
              <div style={{ borderTop: "1px solid #e5e7eb" }} />
              <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", background: "white", color: "#9ca3af", fontSize: 11, fontWeight: 800, padding: "0 .5rem", textTransform: "uppercase" }}>Or continue with</span>
            </div>
            <div style={{ display: "grid", gap: ".75rem" }}>
              <a href={`${backendBaseUrl}/auth0/login`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: ".5rem", border: "1px solid #d1d5db", borderRadius: 6, background: "white", color: "#374151", fontWeight: 800, padding: ".75rem" }}>Google</a>
              <Link href="/partner-signup" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: ".5rem", border: "1px solid #e5e7eb", borderRadius: 6, background: "#f9fafb", color: "#374151", fontWeight: 800, padding: ".75rem" }}>Sign up as Partner</Link>
            </div>
          </>
        ) : (
          <>
            <form action={`${backendBaseUrl}/signup`} method="POST" style={{ display: "grid", gap: "1rem" }}>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <input type="hidden" name="role" value="tenant" />
              <label style={{ display: "grid", gap: ".35rem" }}>
                <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Full Name</span>
                <input className="field" name="name" autoComplete="name" required />
              </label>
              <label style={{ display: "grid", gap: ".35rem" }}>
                <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Email</span>
                <input className="field" name="email" type="email" autoComplete="email" required />
              </label>
              <label style={{ display: "grid", gap: ".35rem" }}>
                <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Phone</span>
                <input className="field" name="phone" type="tel" autoComplete="tel" onChange={(event) => { if (signupPhoneError) setSignupPhoneError(""); event.currentTarget.setCustomValidity(""); }} onBlur={(event) => void checkSignupPhoneAvailability(event.target.value)} />
                {signupPhoneError ? <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{signupPhoneError}</span> : null}
              </label>
              <label style={{ display: "grid", gap: ".35rem" }}>
                <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Referral Code (Optional)</span>
                <input className="field" name="referral_code" defaultValue={refCode} />
              </label>
              <label style={{ display: "grid", gap: ".35rem" }}>
                <span style={{ color: "#374151", fontSize: 12, fontWeight: 800 }}>Password</span>
                <span style={{ position: "relative", display: "block" }}>
                  <input className="field" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} required style={{ paddingRight: 42 }} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "#6b7280", cursor: "pointer" }}>
                    {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                  </button>
                </span>
                <span style={{ display: "block", height: 6, overflow: "hidden", borderRadius: 999, background: "#f3f4f6" }}>
                  <span style={{ display: "block", width: `${strength.width}%`, height: "100%", background: strength.color, transition: "width 180ms ease" }} />
                </span>
                <span style={{ color: strength.color, fontSize: 12, fontWeight: 700 }}>{strength.label}</span>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: ".65rem", color: "#4b5563", fontSize: 14, lineHeight: 1.35 }}>
                <input name="terms" type="checkbox" required style={{ marginTop: 3 }} />
                <span>I agree to the <Link href="/terms" style={{ color: "#dc2626", fontWeight: 800 }}>Terms of Service</Link> and <Link href="/privacy" style={{ color: "#dc2626", fontWeight: 800 }}>Privacy Policy</Link>.</span>
              </label>
              <TurnstileSignupField />
              <button className="btn btn-primary" type="submit" style={{ width: "100%", borderRadius: 6 }}>Sign Up</button>
            </form>
            <div style={{ position: "relative", margin: ".25rem 0" }}>
              <div style={{ borderTop: "1px solid #e5e7eb" }} />
              <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", background: "white", color: "#9ca3af", fontSize: 11, fontWeight: 800, padding: "0 .5rem", textTransform: "uppercase" }}>Or continue with</span>
            </div>
            <div style={{ display: "grid", gap: ".75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
                <button type="button" onClick={() => showLoginMode("otp")} style={{ border: 0, borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", cursor: "pointer", fontSize: 14, fontWeight: 800, padding: ".75rem" }}><Mail size={16} aria-hidden /> Email OTP</button>
                <button type="button" onClick={() => showLoginMode("whatsapp")} style={{ border: 0, borderRadius: 6, background: "rgba(37, 211, 102, .1)", color: "#16a34a", cursor: "pointer", fontSize: 14, fontWeight: 800, padding: ".75rem" }}><Phone size={16} aria-hidden /> WhatsApp</button>
              </div>
              <a href={`${backendBaseUrl}/auth0/login`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: ".5rem", border: "1px solid #d1d5db", borderRadius: 6, background: "white", color: "#374151", fontWeight: 800, padding: ".75rem" }}>Google</a>
              <Link href="/partner-signup" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: ".5rem", border: "1px solid #e5e7eb", borderRadius: 6, background: "#f9fafb", color: "#374151", fontWeight: 800, padding: ".75rem" }}>Sign up as Partner</Link>
            </div>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: ".4rem", color: "#9ca3af", fontSize: 12, fontWeight: 700 }}>
          <LockKeyhole size={14} aria-hidden />
          Express session auth, OTP, and 2FA compatible
        </div>
      </div>
    </div>
  );
}
