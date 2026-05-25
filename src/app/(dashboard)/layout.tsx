import type { ReactNode } from "react";
import { Suspense } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { ActiveClientAccessError, getActiveClientContext } from "@/lib/active-client";

interface DashboardLayoutProps {
  children: ReactNode;
}

function SidebarFallback() {
  return (
    <Sidebar
      unreadCount={null}
      messagesSent={0}
      messageLimit={null}
      plan={null}
    />
  );
}

async function DashboardSidebar() {
  let context: Awaited<ReturnType<typeof getActiveClientContext>>;

  try {
    context = await getActiveClientContext();
  } catch (error) {
    if (error instanceof ActiveClientAccessError) {
      return <SidebarFallback />;
    }

    throw error;
  }

  const { supabase, client } = context;

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

  return (
    <Sidebar
      unreadCount={unreadLeadCount ?? 0}
      messagesSent={outboundMessageCount ?? 0}
      messageLimit={null}
      plan={client.plan}
    />
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-parchment lg:h-screen lg:flex-row">
      <Suspense fallback={<SidebarFallback />}>
        <DashboardSidebar />
      </Suspense>
      <main className="min-w-0 flex-1 overflow-auto bg-parchment">{children}</main>
    </div>
  );
}
