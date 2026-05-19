interface SendFacebookMessageArgs {
  recipientId: string;
  message: string;
  accessToken: string;
}

async function buildError(response: Response, channel: string): Promise<Error> {
  const body = await response.text();
  const detail = body.trim() || response.statusText || "Unknown error";
  return new Error(`${channel} send error (${response.status}): ${detail}`);
}

export async function sendFacebookMessage(
  { recipientId, message, accessToken }: SendFacebookMessageArgs,
): Promise<void> {
  const response = await fetch("https://graph.facebook.com/v18.0/me/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      messaging_type: "RESPONSE",
    }),
  });

  if (!response.ok) {
    throw await buildError(response, "Facebook");
  }
}
