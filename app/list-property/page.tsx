import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListPropertyForm } from "@/components/property/ListPropertyForm";
import { getCurrentUser } from "@/services/api";

export const metadata: Metadata = {
  title: "List Property"
};

export default async function ListPropertyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/list-property");

  return (
    <div className="container" style={{ display: "grid", gap: "1rem", padding: "2rem 0" }}>
      <section>
        <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1 }}>List a property</h1>
        <p style={{ color: "var(--ms-muted)" }}>Submissions post to the existing Express upload and property creation route.</p>
      </section>
      <ListPropertyForm user={user} />
    </div>
  );
}
