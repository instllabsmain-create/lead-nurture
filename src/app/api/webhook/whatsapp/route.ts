import type { NextRequest } from "next/server";

import { handleMetaVerification, handleMetaWebhook } from "@/lib/meta-webhook";
import { normaliseWhatsApp } from "@/lib/normalise";

export function GET(request: NextRequest) {
  return handleMetaVerification(request);
}

export async function POST(request: Request) {
  return handleMetaWebhook({
    request,
    platform: "whatsapp",
    normalise: normaliseWhatsApp,
  });
}
