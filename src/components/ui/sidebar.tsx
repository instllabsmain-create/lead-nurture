"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/ui/wordmark";

interface SidebarProps {
  unreadCount: number | null;
  messagesSent: number;
  messageLimit: number | null;
  plan: string | null;
}

interface NavItem {
  href: string;
  label: string;
  badgeCount?: number | null;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/leads", label: "Leads" },
  { href: "/broadcasts", label: "Broadcasts" },
  { href: "/agents", label: "Agents" },
  { href: "/channels", label: "Channels" },
  { href: "/knowledge", label: "Knowledge Base" },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getNavClassName(isActive: boolean): string {
  if (isActive) {
    return "rounded-md bg-ember px-3 py-2 font-body text-sm font-medium text-ember-text transition-all duration-150";
  }

  return "rounded-md px-3 py-2 font-body text-sm text-dust transition-all duration-150 hover:bg-parchment hover:text-pitch active:scale-[0.98]";
}

export function Sidebar({
  unreadCount,
  messagesSent,
  messageLimit,
  plan,
}: SidebarProps) {
  const pathname = usePathname();

  if (pathname === "/onboarding") {
    return null;
  }

  const usagePercent =
    messageLimit && messageLimit > 0
      ? Math.min(100, Math.round((messagesSent / messageLimit) * 100))
      : 0;

  return (
    <aside className="flex h-screen w-[200px] shrink-0 flex-col border-r border-border bg-white px-4 py-5">
      <div className="mb-8">
        <Wordmark />
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          const showBadge = item.label === "Inbox" && unreadCount && unreadCount > 0;

          return (
            <Link key={item.href} href={item.href} className={getNavClassName(isActive)}>
              <span className="flex items-center justify-between gap-2">
                <span>{item.label}</span>
                {showBadge ? (
                  <span className="rounded-full bg-saffron px-1.5 py-0.5 font-mono text-[9px] text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-5 pt-6">
        <div>
          <div className="mb-1.5 font-mono text-[8px] uppercase tracking-[2px] text-dust">
            Message usage
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-saffron"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="mt-1 font-mono text-[9px] text-dust">
            {messageLimit && messageLimit > 0
              ? `${messagesSent} of ${messageLimit}`
              : `${messagesSent} sent`}
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase tracking-[2px] text-dust">
            {plan ? `${plan} plan` : "Plan"}
          </div>
        </div>

        <Link
          href="/settings"
          className={getNavClassName(isNavItemActive(pathname, "/settings"))}
        >
          Settings
        </Link>
      </div>
    </aside>
  );
}

export default Sidebar;
