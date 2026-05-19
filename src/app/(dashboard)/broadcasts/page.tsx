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
        <SectionLabel>Phase 2</SectionLabel>
        <h2 className="mt-3 font-display text-3xl font-black uppercase text-pitch">
          Bulk campaigns are coming in Phase 2.
        </h2>
        <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-dust">
          Broadcasts will let you send proactive messages to selected leads based
          on audience rules, channel availability, and campaign timing. This page
          is intentionally a placeholder until the Phase 2 campaign flow is built.
        </p>
      </Card>
    </div>
  );
}
