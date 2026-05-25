import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";

export default function BroadcastsPage() {
  return (
    <div className="flex flex-col gap-6 p-8 sm:p-10">
      <div className="flex flex-col gap-4">
        <SectionLabel>Broadcasts</SectionLabel>
        <div>
          <h1 className="font-display text-4xl font-black uppercase text-pitch">
            Broadcasts
          </h1>
        </div>
      </div>

      <Card>
        <SectionLabel>Campaigns</SectionLabel>
        <h2 className="mt-3 font-display text-3xl font-black uppercase text-pitch">
          Campaign sending is not enabled yet.
        </h2>
        <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-dust">
          Keep this section off until campaign rules, consent checks, and
          channel throttling are ready. Use Inbox and Leads for manual follow-up today.
        </p>
      </Card>
    </div>
  );
}
