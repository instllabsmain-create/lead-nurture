import { loadInboxData } from "@/app/(dashboard)/inbox/_data";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId")?.trim();

  const data = await loadInboxData({
    selectedLeadId: leadId || undefined,
    redirectIfMissingLead: false,
  });

  return Response.json(data);
}
