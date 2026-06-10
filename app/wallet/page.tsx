import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { backendBaseUrl } from "@/lib/config";
import { getCurrentUser, getWallet } from "@/services/api";

export const metadata: Metadata = {
  title: "Wallet"
};

function value(input: unknown): string {
  return input === null || input === undefined ? "" : String(input);
}

export default async function WalletPage() {
  const [user, wallet] = await Promise.all([getCurrentUser(), getWallet()]);
  if (!user) redirect("/login?redirect=/wallet");
  const walletUser = (wallet?.user ?? user) as unknown as Record<string, unknown>;
  const withdrawals = wallet?.withdrawals ?? [];

  return (
    <div className="container" style={{ display: "grid", gap: "1.25rem", padding: "2rem 0 3rem" }}>
      <section className="surface" style={{ display: "grid", gap: ".6rem", borderRadius: 8, padding: "1.25rem" }}>
        <span className="ms-chip" style={{ color: "#166534", background: "#f0fdf4", borderColor: "#bbf7d0" }}>Referral wallet</span>
        <h1 className="text-4xl font-black text-slate-950">Wallet</h1>
        <strong className="text-3xl font-black text-slate-950">Rs. {value(walletUser.wallet_balance) || "0"}</strong>
      </section>

      <form action={`${backendBaseUrl}/user/withdraw`} method="POST" className="surface" style={{ display: "grid", gap: ".9rem", borderRadius: 8, padding: "1.25rem", maxWidth: 720 }}>
        <h2 className="text-xl font-black text-slate-950">Request withdrawal</h2>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Amount<input className="field" name="amount" type="number" min="1" required /></label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Payment details<textarea className="field" name="payment_details" rows={3} required /></label>
        <button className="btn btn-primary" type="submit">Submit withdrawal</button>
      </form>

      <section className="surface" style={{ borderRadius: 8, overflow: "hidden" }}>
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-xl font-black text-slate-950">Withdrawal history</h2>
        </div>
        <div className="grid gap-2 p-4">
          {withdrawals.length ? withdrawals.map((item, index) => (
            <div key={String(item.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm">
              <strong>Rs. {value(item.amount)}</strong>
              <p className="text-slate-500">{value(item.status)} {value(item.created_at) ? `- ${value(item.created_at)}` : ""}</p>
            </div>
          )) : <p className="text-sm font-medium text-slate-500">No withdrawals yet.</p>}
        </div>
      </section>
    </div>
  );
}
