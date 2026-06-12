import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Logout"
};

export default function LogoutPage() {
  redirect("/api/logout");
}
