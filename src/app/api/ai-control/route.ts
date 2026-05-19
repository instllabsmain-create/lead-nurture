import { z } from "zod";

import { getActiveClientContext } from "@/lib/active-client";

const schema = z.object({
  leadId: z.uuid(),
  paused: z.boolean(),
});

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const { supabase, client } = await getActiveClientContext();
    const body = schema.safeParse((await request.json()) as unknown);

    if (!body.success) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { error } = await supabase
      .from("leads")
      .update({ ai_paused: body.data.paused })
      .eq("id", body.data.leadId)
      .eq("client_id", client.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(`AI control failed: ${getSafeErrorMessage(error)}`);
    return Response.json({ error: "Failed to update AI control" }, { status: 500 });
  }
}
