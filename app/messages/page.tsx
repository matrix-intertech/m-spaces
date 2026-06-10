import { redirect } from "next/navigation";
import { MessagingWorkspace } from "@/components/chat/MessagingWorkspace";
import { getConversationMessages, getConversations, getCurrentUser, getProperty } from "@/services/api";

export default async function MessagesPage({
  searchParams
}: {
  searchParams: Promise<{ conversationId?: string; section?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/messages");

  const [conversations, params] = await Promise.all([getConversations(), searchParams]);
  const section = params.section === "purchasing" ? "purchasing" : "management";
  const currentUserId = Number(user.id);
  const sectionConversations = conversations.filter((conversation) =>
    section === "purchasing"
      ? Number(conversation.buyer_id) === currentUserId
      : Number(conversation.buyer_id) !== currentUserId
  );
  const requestedId = Number(params.conversationId);
  const selectedConversation =
    sectionConversations.find((conversation) => Number(conversation.id) === requestedId) || sectionConversations[0] || null;
  const selectedConversationId = selectedConversation ? Number(selectedConversation.id) : null;

  const [initialMessages, property] = selectedConversation
    ? await Promise.all([
        getConversationMessages(String(selectedConversation.id)),
        selectedConversation.property_id ? getProperty(String(selectedConversation.property_id)) : Promise.resolve(null)
      ])
    : [[], null];

  return (
    <MessagingWorkspace
      user={user}
      conversations={conversations}
      initialConversationId={selectedConversationId}
      initialMessages={initialMessages}
      initialProperty={property}
      initialSection={section}
    />
  );
}
