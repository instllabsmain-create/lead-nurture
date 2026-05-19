interface SendWhatsAppMessageArgs {
  to: string;
  message: string;
  phoneNumberId: string;
  accessToken: string;
}

async function buildError(response: Response, channel: string): Promise<Error> {
  const body = await response.text();
  const detail = body.trim() || response.statusText || "Unknown error";
  return new Error(`${channel} send error (${response.status}): ${detail}`);
}

export async function sendWhatsAppMessage(
  { to, message, phoneNumberId, accessToken }: SendWhatsAppMessageArgs,
): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    },
  );

  if (!response.ok) {
    throw await buildError(response, "WhatsApp");
  }
}
