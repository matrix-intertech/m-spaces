import { redirect } from "next/navigation";

export default function MyChatsRedirect() {
  redirect("/messages");
}
