import { loadInboxData } from "@/app/(dashboard)/inbox/_data";
import { InboxShell } from "@/components/inbox/inbox-shell";

export default async function InboxPage() {
  const data = await loadInboxData();

  return (
    <InboxShell
      key="inbox-list"
      clientId={data.client.id}
      initialConversations={data.conversations}
    />
  );
}
