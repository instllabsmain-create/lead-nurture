import type { ReactNode } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { getActiveClientContext } from "@/lib/active-client";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const { supabase, client } = await getActiveClientContext();

  let unreadCount: number | null = null;
  let messagesSent = 0;

  const [{ count: unreadLeadCount }, { count: outboundMessageCount }] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("status", "new"),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("direction", "outbound"),
  ]);

  unreadCount = unreadLeadCount ?? 0;
  messagesSent = outboundMessageCount ?? 0;

  return (
    <div className="flex h-screen bg-parchment">
      <Sidebar
        unreadCount={unreadCount}
        messagesSent={messagesSent}
        messageLimit={null}
        plan={client.plan}
      />
      <main className="min-w-0 flex-1 overflow-auto bg-parchment">{children}</main>
    </div>
  );
}
