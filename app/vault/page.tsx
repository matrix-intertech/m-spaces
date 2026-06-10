import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { backendBaseUrl } from "@/lib/config";
import { getCurrentUser, getVault } from "@/services/api";

export const metadata: Metadata = {
  title: "Vault"
};

function value(input: unknown): string {
  return input === null || input === undefined ? "" : String(input);
}

export default async function VaultPage() {
  const [user, vault] = await Promise.all([getCurrentUser(), getVault()]);
  if (!user) redirect("/login?redirect=/vault");
  const folders = vault?.folders ?? [];
  const documents = vault?.documents ?? [];

  return (
    <div className="container" style={{ display: "grid", gap: "1.25rem", padding: "2rem 0 3rem" }}>
      <section className="surface" style={{ display: "grid", gap: ".6rem", borderRadius: 8, padding: "1.25rem" }}>
        <span className="ms-chip" style={{ color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" }}>Private documents</span>
        <h1 className="text-4xl font-black text-slate-950">Vault</h1>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form action={`${backendBaseUrl}/vault/folder/create`} method="POST" className="surface" style={{ display: "grid", gap: ".9rem", borderRadius: 8, padding: "1.25rem" }}>
          <h2 className="text-xl font-black text-slate-950">Create folder</h2>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Folder name<input className="field" name="folderName" required /></label>
          <button className="btn btn-primary" type="submit">Create folder</button>
        </form>
        <form action={`${backendBaseUrl}/vault/upload`} method="POST" encType="multipart/form-data" className="surface" style={{ display: "grid", gap: ".9rem", borderRadius: 8, padding: "1.25rem" }}>
          <h2 className="text-xl font-black text-slate-950">Upload document</h2>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Document name<input className="field" name="documentName" required /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Document number<input className="field" name="documentNumber" /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">File<input className="field" name="document" type="file" required /></label>
          <button className="btn btn-primary" type="submit">Upload document</button>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
          <h2 className="text-xl font-black text-slate-950">Folders</h2>
          <div className="mt-4 grid gap-2">
            {folders.length ? folders.map((item, index) => (
              <div key={String(item.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm">
                <strong>{value(item.name) || "Folder"}</strong>
                <p className="text-slate-500">{value(item.created_at)}</p>
              </div>
            )) : <p className="text-sm font-medium text-slate-500">No folders yet.</p>}
          </div>
        </article>
        <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
          <h2 className="text-xl font-black text-slate-950">Documents</h2>
          <div className="mt-4 grid gap-2">
            {documents.length ? documents.map((item, index) => (
              <div key={String(item.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm">
                <strong>{value(item.filename) || "Document"}</strong>
                <p className="text-slate-500">{value(item.created_at)}</p>
              </div>
            )) : <p className="text-sm font-medium text-slate-500">No documents yet.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}
