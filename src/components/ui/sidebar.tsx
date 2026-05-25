"use client";

import { UserButton } from "@clerk/nextjs";
import Link, { useLinkStatus } from "next/link";
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
    return "flex min-h-11 items-center rounded-md bg-ember px-3 py-2 font-body text-sm font-medium text-ember-text transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  }

  return "flex min-h-11 items-center rounded-md px-3 py-2 font-body text-sm text-dust transition-all duration-150 hover:bg-parchment hover:text-pitch active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
}

function NavPendingHint() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={`h-1.5 w-1.5 shrink-0 rounded-full bg-saffron transition-opacity duration-150 ${pending ? "opacity-100" : "opacity-0"}`}
    />
  );
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
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-white/95 px-4 py-4 shadow-[0_10px_28px_rgba(41,28,16,0.04)] lg:h-screen lg:w-[220px] lg:border-b-0 lg:border-r lg:py-5 lg:shadow-none">
      <div className="mb-4 flex items-center justify-between gap-3 lg:mb-8 lg:block">
        <Wordmark />
        <div className="lg:hidden">
          <UserButton />
        </div>
      </div>

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:grid-cols-none lg:flex-col lg:gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          const showBadge = item.label === "Inbox" && unreadCount && unreadCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={getNavClassName(isActive)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span>{item.label}</span>
                <span className="flex items-center gap-1.5">
                  {showBadge ? (
                    <span className="rounded-full bg-saffron px-1.5 py-0.5 font-mono text-[9px] text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                  <NavPendingHint />
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 hidden flex-col gap-5 border-t border-border pt-5 lg:mt-auto lg:flex">
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
          prefetch
          className={getNavClassName(isNavItemActive(pathname, "/settings"))}
        >
          <span className="flex w-full items-center justify-between gap-2">
            <span>Settings</span>
            <NavPendingHint />
          </span>
        </Link>

        <div className="flex items-center justify-between rounded-md border border-border bg-parchment px-3 py-2">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
            Account
          </span>
          <UserButton />
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
