"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { backendBaseUrl } from "@/lib/config";
import { TurnstileSignupField } from "@/components/auth/TurnstileSignupField";
import { getClientCsrfToken } from "@/lib/csrf-client";

type PartnerRole = "builder" | "broker" | "external_sales";
type SignupMode = "whatsapp" | "standard";
type AccountType = { role: string; label: string; count?: number };

const roles: Array<{ value: PartnerRole; label: string }> = [
  { value: "builder", label: "Builder / Developer" },
  { value: "broker", label: "Broker" },
  { value: "external_sales", label: "Sales Agent" }
];

function roleTitle(role: PartnerRole) {
  if (role === "builder") return "Builder";
  if (role === "external_sales") return "Sales Agent";
  return "Broker";
}

function partnerFieldClass() {
  return "w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all";
}

async function postJson(path: string, body: Record<string, unknown>) {
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
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || payload.message || "Request failed"), { payload, status: response.status });
  return payload;
}

export function PartnerSignupForm({
  initialRole = "builder",
  refCode = "",
  initialError = ""
}: {
  initialRole?: PartnerRole;
  refCode?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<PartnerRole>(initialRole);
  const [mode, setMode] = useState<SignupMode>("whatsapp");
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [reraNumber, setReraNumber] = useState("");
  const [referralCode, setReferralCode] = useState(refCode);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [selectedAccountType, setSelectedAccountType] = useState("");
  const [phoneExistsError, setPhoneExistsError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    if (!initialError) return;
    const timer = window.setTimeout(() => {
      window.alert(initialError);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [initialError]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    void getClientCsrfToken().then(setCsrfToken).catch(() => {});
  }, []);

  async function requestWhatsAppOtp(isResend = false) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await postJson("/send-whatsapp-otp", { phone });
      setOtpSent(true);
      setResendSeconds(30);
      setMessage(isResend ? "WhatsApp OTP resent successfully." : "WhatsApp OTP sent successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send WhatsApp OTP");
    } finally {
      setLoading(false);
    }
  }

  async function checkPhoneAvailability(phoneValue: string) {
    const trimmed = phoneValue.trim();
    if (!trimmed) {
      setPhoneExistsError("");
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
      setPhoneExistsError(payload?.errors?.phone ?? "");
    } catch {
      setPhoneExistsError("");
    }
  }

  async function verifyWhatsAppOtp() {
    if (otp.replace(/\D/g, "").length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if ((role === "builder" || role === "broker") && !agencyName.trim() && !selectedAccountType) {
      setError("Company / Agency Name is required.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const payload = await postJson("/login/whatsapp-otp", {
        phone,
        otp,
        role: selectedAccountType || role,
        name,
        agency_name: agencyName,
        gst_number: gstNumber,
        rera_number: reraNumber,
        referral_code: referralCode
      });
      router.push(payload.redirect || "/");
      router.refresh();
    } catch (err) {
      const payload = (err as { payload?: { requiresAccountType?: boolean; accountTypes?: AccountType[] } }).payload;
      if (payload?.requiresAccountType) {
        const nextTypes = payload.accountTypes ?? [];
        setAccountTypes(nextTypes);
        setSelectedAccountType(nextTypes[0]?.role ?? "");
      }
      setError(err instanceof Error ? err.message : "Invalid WhatsApp OTP");
    } finally {
      setLoading(false);
    }
  }

  const showBusinessFields = role === "builder" || role === "broker";

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl transition-shadow duration-500">
      <div className="bg-gray-900 text-white text-center py-6 px-4">
        <h1 className="text-2xl font-black">Partner Registration</h1>
        <p className="text-sm text-gray-300 mt-1">Join MatrixSpaces as a professional</p>
      </div>

      <div className="p-5 md:p-6">
        {error ? <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm font-bold border border-red-200">{error}</div> : null}
        {message ? <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4 text-sm font-bold border border-green-200">{message}</div> : null}
        {refCode ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm font-bold mb-5">
            Referral code applied. You are signing up via a partner link.
          </div>
        ) : null}

        <label className="block mb-5">
          <span className="block text-xs font-bold text-gray-700 mb-1">Register As</span>
          <select value={role} onChange={(event) => setRole(event.target.value as PartnerRole)} className={partnerFieldClass()}>
            {roles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {mode === "standard" ? (
          <div className="space-y-4">
            {role === "builder" ? (
              <form action={`${backendBaseUrl}/signup/builder`} method="POST" encType="multipart/form-data" className="space-y-4">
                <input type="hidden" name="_csrf" value={csrfToken} />
                <PartnerIdentityFields refCode={referralCode} showBusinessFields onReferralChange={setReferralCode} phoneError={phoneExistsError} onPhoneChange={(value) => { if (phoneExistsError) setPhoneExistsError(""); void checkPhoneAvailability(value); }} />
                <KycFields />
                <Terms />
                <TurnstileSignupField />
                <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-md font-bold hover:bg-gray-800 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
                  Register as Builder
                </button>
              </form>
            ) : (
              <form action={`${backendBaseUrl}/signup`} method="POST" className="space-y-4">
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="role" value={role} />
                <PartnerIdentityFields refCode={referralCode} showBusinessFields={role === "broker"} onReferralChange={setReferralCode} phoneError={phoneExistsError} onPhoneChange={(value) => { if (phoneExistsError) setPhoneExistsError(""); void checkPhoneAvailability(value); }} />
                <Terms />
                <TurnstileSignupField />
                <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-md font-bold hover:bg-red-700 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
                  Register as {roleTitle(role)}
                </button>
              </form>
            )}

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400 font-bold">Or continue with</span>
              </div>
            </div>
            <button type="button" onClick={() => setMode("whatsapp")} className="w-full bg-[#25D366]/10 text-[#25D366] py-2.5 rounded-md text-sm font-bold hover:bg-[#25D366]/20 transition-all flex items-center justify-center gap-2 shadow-sm">
              Register with WhatsApp
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Phone Number</span>
              <input value={phone} onChange={(event) => { setPhone(event.target.value); if (phoneExistsError) setPhoneExistsError(""); }} onBlur={(event) => void checkPhoneAvailability(event.target.value)} readOnly={otpSent} type="tel" className={`${partnerFieldClass()} ${otpSent ? "bg-gray-50" : ""}`} required />
              {phoneExistsError ? <span className="mt-1 block text-xs font-bold text-red-600">{phoneExistsError}</span> : null}
            </label>
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Full Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} type="text" className={partnerFieldClass()} required />
            </label>
            {showBusinessFields ? (
              <>
                <label>
                  <span className="block text-xs font-bold text-gray-700 mb-1">Company / Agency Name</span>
                  <input value={agencyName} onChange={(event) => setAgencyName(event.target.value)} type="text" className={partnerFieldClass()} required />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="block text-xs font-bold text-gray-700 mb-1">GST Number</span>
                    <input value={gstNumber} onChange={(event) => setGstNumber(event.target.value)} type="text" className={partnerFieldClass()} />
                  </label>
                  <label>
                    <span className="block text-xs font-bold text-gray-700 mb-1">RERA Number</span>
                    <input value={reraNumber} onChange={(event) => setReraNumber(event.target.value)} type="text" className={partnerFieldClass()} />
                  </label>
                </div>
              </>
            ) : null}
            {otpSent ? (
              <label>
                <span className="block text-xs font-bold text-gray-700 mb-1">Enter 6-digit WhatsApp OTP</span>
                <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} type="text" inputMode="numeric" maxLength={6} className={`${partnerFieldClass()} text-center tracking-[0.5em] font-mono text-lg`} />
              </label>
            ) : null}
            {(refCode || otpSent) ? (
              <label>
                <span className="block text-xs font-bold text-gray-700 mb-1">Referral Code (Optional)</span>
                <input value={referralCode} onChange={(event) => setReferralCode(event.target.value)} type="text" className={`${partnerFieldClass()} uppercase placeholder:normal-case`} />
              </label>
            ) : null}
            {accountTypes.length ? (
              <label>
                <span className="block text-xs font-bold text-gray-700 mb-1">Select Account Type</span>
                <select value={selectedAccountType} onChange={(event) => setSelectedAccountType(event.target.value)} className={partnerFieldClass()}>
                  {accountTypes.map((accountType) => (
                    <option key={accountType.role} value={accountType.role}>
                      {accountType.count && accountType.count > 1 ? `${accountType.label} (${accountType.count} accounts)` : accountType.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500 mt-1 block">This phone number is linked to more than one account.</span>
              </label>
            ) : null}

            {!otpSent ? (
              <button type="button" disabled={loading} onClick={() => void requestWhatsAppOtp()} className="w-full bg-[#25D366] text-white py-3 rounded-md font-bold hover:bg-[#20bd5a] hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-70">
                {loading ? "Sending..." : "Send WhatsApp OTP"}
              </button>
            ) : (
              <>
                <button type="button" disabled={loading} onClick={() => void verifyWhatsAppOtp()} className="w-full bg-[#25D366] text-white py-3 rounded-md font-bold hover:bg-[#20bd5a] hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-70">
                  {loading ? "Verifying..." : "Verify & Register"}
                </button>
                <div className="text-center mt-3">
                  <span className="text-xs text-gray-500">Didn't receive the code? </span>
                  <button type="button" disabled={loading || resendSeconds > 0} onClick={() => void requestWhatsAppOtp(true)} className="text-xs font-bold text-[#25D366] hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed">
                    {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend OTP"}
                  </button>
                </div>
              </>
            )}

            <button type="button" onClick={() => setMode("standard")} className="w-full bg-gray-50 text-gray-700 py-2.5 rounded-md text-sm font-bold hover:bg-gray-100 hover:text-gray-900 transition-all flex items-center justify-center gap-2 hover:border-gray-200">
              Register with Password instead
            </button>
          </div>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-500">Already have an account?</span>{" "}
          <Link href="/login" className="text-red-600 font-bold hover:underline">
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}

function PartnerIdentityFields({
  refCode,
  showBusinessFields,
  onReferralChange,
  phoneError,
  onPhoneChange
}: {
  refCode: string;
  showBusinessFields: boolean;
  onReferralChange: (value: string) => void;
  phoneError?: string;
  onPhoneChange?: (value: string) => void;
}) {
  return (
    <>
      <label>
        <span className="block text-xs font-bold text-gray-700 mb-1">Full Name</span>
        <input type="text" name="name" autoComplete="name" className={partnerFieldClass()} required />
      </label>
      <label>
        <span className="block text-xs font-bold text-gray-700 mb-1">Email</span>
        <input type="email" name="email" autoComplete="email" className={partnerFieldClass()} required />
      </label>
      <label>
        <span className="block text-xs font-bold text-gray-700 mb-1">Phone (Optional)</span>
        <input type="tel" name="phone" autoComplete="tel" className={partnerFieldClass()} onBlur={(event) => onPhoneChange?.(event.target.value)} onChange={() => { if (phoneError) onPhoneChange?.(""); }} />
        {phoneError ? <span className="mt-1 block text-xs font-bold text-red-600">{phoneError}</span> : null}
      </label>
      {showBusinessFields ? (
        <>
          <label>
            <span className="block text-xs font-bold text-gray-700 mb-1">Company / Agency Name</span>
            <input type="text" name="agency_name" className={partnerFieldClass()} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">GST Number (Optional)</span>
              <input type="text" name="gst_number" className={`${partnerFieldClass()} uppercase placeholder:normal-case`} />
            </label>
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">RERA Number (Optional)</span>
              <input type="text" name="rera_number" className={`${partnerFieldClass()} uppercase placeholder:normal-case`} />
            </label>
          </div>
        </>
      ) : null}
      <label>
        <span className="block text-xs font-bold text-gray-700 mb-1">Referral Code (Optional)</span>
        <input type="text" name="referral_code" value={refCode} onChange={(event) => onReferralChange(event.target.value)} className={`${partnerFieldClass()} uppercase placeholder:normal-case`} />
      </label>
      <label>
        <span className="block text-xs font-bold text-gray-700 mb-1">Password</span>
        <input type="password" name="password" autoComplete="new-password" className={partnerFieldClass()} required />
      </label>
    </>
  );
}

function KycFields() {
  const fields = [
    ["aadhaar", "Aadhaar Card (Optional)"],
    ["pan", "PAN Card (Optional)"],
    ["license", "Driver's License (Optional)"],
    ["passport", "Passport (Optional)"]
  ];
  return (
    <div className="border-t border-gray-200 pt-4">
      <h6 className="text-sm font-bold text-gray-800 mb-3">KYC Documents (Indian Citizens Only)</h6>
      <div className="space-y-3">
        {fields.map(([name, label]) => (
          <label key={name}>
            <span className="block text-xs font-bold text-gray-700 mb-1">{label}</span>
            <input type="file" name={name} accept="image/*,.pdf" className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer" />
          </label>
        ))}
      </div>
    </div>
  );
}

function Terms() {
  return (
    <label className="flex items-start gap-3 cursor-pointer p-2 -ml-2 rounded-md hover:bg-gray-50 transition-colors">
      <input type="checkbox" name="terms" required className="w-5 h-5 mt-0.5 text-red-600 rounded border-gray-300 focus:ring-red-500 flex-shrink-0" />
      <span className="text-sm text-gray-600 leading-tight">
        I agree to the <Link href="/terms" className="text-red-600 hover:underline font-bold">Terms of Service</Link> and{" "}
        <Link href="/privacy" className="text-red-600 hover:underline font-bold">Privacy Policy</Link>.
      </span>
    </label>
  );
}
