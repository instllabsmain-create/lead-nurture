import type { ReactNode } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { ActiveClientAccessError, getActiveClientContext } from "@/lib/active-client";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  let supabase: Awaited<ReturnType<typeof getActiveClientContext>>["supabase"];
  let client: Awaited<ReturnType<typeof getActiveClientContext>>["client"];

  try {
    const context = await getActiveClientContext();
    supabase = context.supabase;
    client = context.client;
  } catch (error) {
    if (error instanceof ActiveClientAccessError) {
      return (
        <main className="min-h-screen bg-parchment px-6 py-10">
          <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center">
            <div className="w-full rounded-3xl border border-border bg-white/80 p-8 shadow-[0_24px_80px_rgba(41,28,16,0.08)] backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-[2.5px] text-dust">
                Workspace Access
              </p>
              <h1 className="mt-4 font-display text-4xl font-black uppercase text-pitch">
                This account is not linked yet.
              </h1>
              <p className="mt-4 max-w-xl font-body text-sm leading-6 text-dust">
                Your Clerk session is working, but this account is not attached to a client workspace.
                In local development the next refresh should attach you automatically to the configured demo client.
                If this happens in production, add your email to the client record or the authorized Clerk email list.
              </p>
            </div>
          </div>
        </main>
      );
    }

    throw error;
  }

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
    <div className="flex min-h-screen flex-col bg-parchment lg:h-screen lg:flex-row">
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
