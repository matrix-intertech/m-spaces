import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/api";

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/messages/${conversationId}`);
  redirect(`/messages?conversationId=${conversationId}`);
}
