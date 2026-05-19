import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  let unreadCount: number | null = null;
  let messagesSent = 0;

  if (client) {
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
  }

  return (
    <div className="flex h-screen bg-parchment">
      <Sidebar
        unreadCount={unreadCount}
        messagesSent={messagesSent}
        messageLimit={null}
        plan={client?.plan ?? null}
      />
      <main className="min-w-0 flex-1 overflow-auto bg-parchment">{children}</main>
    </div>
  );
}
