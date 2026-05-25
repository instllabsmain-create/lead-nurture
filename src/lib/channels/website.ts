interface SendWebsiteMessageArgs {
  sessionId: string;
  message: string;
  clientId: string;
}

export async function sendWebsiteMessage(
  { sessionId, message, clientId }: SendWebsiteMessageArgs,
): Promise<void> {
  void sessionId;
  void message;
  void clientId;
}
