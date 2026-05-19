import { sendFacebookMessage } from "@/lib/channels/facebook";
import { sendInstagramMessage } from "@/lib/channels/instagram";
import { sendWebsiteMessage } from "@/lib/channels/website";
import { sendWhatsAppMessage } from "@/lib/channels/whatsapp";
import type { Platform } from "@/types";

interface SendViaChannelParams {
  recipientId: string;
  message: string;
  accessToken?: string | null;
  phoneNumberId?: string;
  clientId?: string;
}

function requireString(
  value: string | null | undefined,
  field: string,
  channel: Platform,
): string {
  if (!value) {
    throw new Error(`Missing ${field} for ${channel} send`);
  }

  return value;
}

export async function sendViaChannel(
  channel: Platform,
  { recipientId, message, accessToken, phoneNumberId, clientId }: SendViaChannelParams,
): Promise<void> {
  switch (channel) {
    case "instagram":
      return sendInstagramMessage({
        recipientId,
        message,
        accessToken: requireString(accessToken, "accessToken", channel),
      });
    case "whatsapp":
      return sendWhatsAppMessage({
        to: recipientId,
        message,
        phoneNumberId: requireString(phoneNumberId, "phoneNumberId", channel),
        accessToken: requireString(accessToken, "accessToken", channel),
      });
    case "facebook":
      return sendFacebookMessage({
        recipientId,
        message,
        accessToken: requireString(accessToken, "accessToken", channel),
      });
    case "website":
      return sendWebsiteMessage({
        sessionId: recipientId,
        message,
        clientId: requireString(clientId, "clientId", channel),
      });
  }
}
