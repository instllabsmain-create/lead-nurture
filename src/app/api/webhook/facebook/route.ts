import type { NextRequest } from "next/server";

import { handleMetaVerification, handleMetaWebhook } from "@/lib/meta-webhook";
import { normaliseFacebook } from "@/lib/normalise";

export function GET(request: NextRequest) {
  return handleMetaVerification(request);
}

export async function POST(request: Request) {
  return handleMetaWebhook({
    request,
    platform: "facebook",
    normalise: (payload) => normaliseFacebook(payload),
  });
}
