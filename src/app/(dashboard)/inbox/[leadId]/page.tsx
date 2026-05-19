import { loadInboxData } from "@/app/(dashboard)/inbox/_data";
import { InboxShell } from "@/components/inbox/inbox-shell";

interface InboxLeadPageProps {
  params: Promise<{
    leadId: string;
  }>;
}

export default async function InboxLeadPage({
  params,
}: InboxLeadPageProps) {
  const { leadId } = await params;
  const data = await loadInboxData({ selectedLeadId: leadId });

  if (!data.selectedLead) {
    return null;
  }

  return (
    <InboxShell
      key={leadId}
      clientId={data.client.id}
      initialConversations={data.conversations}
      activeLeadId={leadId}
      initialLead={data.selectedLead}
      initialMessages={data.messages}
    />
  );
}
