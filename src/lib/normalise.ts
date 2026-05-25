import type { MessageContent, NormalisedMessage, Platform } from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, channel: Platform, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${channel} payload: expected object at ${path}`);
  }

  return value;
}

function getRequiredRecord(
  source: Record<string, unknown>,
  key: string,
  channel: Platform,
  path: string,
): Record<string, unknown> {
  return assertRecord(source[key], channel, `${path}.${key}`);
}

function getOptionalRecord(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = source[key];
  return isRecord(value) ? value : undefined;
}

function getRequiredArray(
  source: Record<string, unknown>,
  key: string,
  channel: Platform,
  path: string,
): unknown[] {
  const value = source[key];

  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${channel} payload: expected array at ${path}.${key}`);
  }

  return value;
}

function getOptionalArrayItem(
  source: Record<string, unknown>,
  key: string,
  index: number,
): Record<string, unknown> | undefined {
  const value = source[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  const item = value[index];
  return isRecord(item) ? item : undefined;
}

function getRequiredString(
  source: Record<string, unknown>,
  key: string,
  channel: Platform,
  path: string,
): string {
  const value = source[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${channel} payload: expected string at ${path}.${key}`);
  }

  return value;
}

function getOptionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getIsoTimestamp(value: unknown, channel: Platform, path: string): string {
  const numericTimestamp =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericTimestamp)) {
    throw new Error(`Invalid ${channel} payload: expected timestamp at ${path}`);
  }

  const timestampMs =
    numericTimestamp >= 1_000_000_000_000 ? numericTimestamp : numericTimestamp * 1000;
  const date = new Date(timestampMs);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${channel} payload: invalid timestamp at ${path}`);
  }

  return date.toISOString();
}

function getSupportedContentType(value: unknown): MessageContent["type"] {
  if (value === "image" || value === "audio") {
    return value;
  }

  return "text";
}

function buildNormalisedMessage({
  channel,
  clientId,
  from,
  to,
  content,
  timestamp,
  raw,
}: {
  channel: Platform;
  clientId?: string;
  from: NormalisedMessage["from"];
  to: NormalisedMessage["to"];
  content: MessageContent;
  timestamp: string;
  raw: Record<string, unknown>;
}): NormalisedMessage {
  return {
    client_id: clientId,
    channel,
    direction: "inbound",
    from,
    to,
    content,
    timestamp,
    raw,
  };
}

export function normaliseInstagram(
  payload: unknown,
  clientId?: string,
): NormalisedMessage[] {
  const root = assertRecord(payload, "instagram", "payload");
  const entries = getRequiredArray(root, "entry", "instagram", "payload");
  const results: NormalisedMessage[] = [];

  for (let ei = 0; ei < entries.length; ei++) {
    const entry = assertRecord(entries[ei], "instagram", `payload.entry[${ei}]`);
    const messagingItems = getRequiredArray(entry, "messaging", "instagram", `payload.entry[${ei}]`);

    for (let mi = 0; mi < messagingItems.length; mi++) {
      const messaging = assertRecord(messagingItems[mi], "instagram", `payload.entry[${ei}].messaging[${mi}]`);
      const sender = getRequiredRecord(messaging, "sender", "instagram", `payload.entry[${ei}].messaging[${mi}]`);
      const recipient = getRequiredRecord(messaging, "recipient", "instagram", `payload.entry[${ei}].messaging[${mi}]`);
      const message = getOptionalRecord(messaging, "message");

      results.push(buildNormalisedMessage({
        channel: "instagram",
        clientId,
        from: { id: getRequiredString(sender, "id", "instagram", `payload.entry[${ei}].messaging[${mi}].sender`) },
        to: { id: getRequiredString(recipient, "id", "instagram", `payload.entry[${ei}].messaging[${mi}].recipient`) },
        content: {
          type: "text",
          text: message ? getOptionalString(message, "text") : undefined,
        },
        timestamp: getIsoTimestamp(messaging.timestamp, "instagram", `payload.entry[${ei}].messaging[${mi}].timestamp`),
        raw: root,
      }));
    }
  }

  return results;
}

export function normaliseWhatsApp(
  payload: unknown,
  clientId?: string,
): NormalisedMessage[] {
  const root = assertRecord(payload, "whatsapp", "payload");
  const entries = getRequiredArray(root, "entry", "whatsapp", "payload");
  const results: NormalisedMessage[] = [];

  for (let ei = 0; ei < entries.length; ei++) {
    const entry = assertRecord(entries[ei], "whatsapp", `payload.entry[${ei}]`);
    const changes = getRequiredArray(entry, "changes", "whatsapp", `payload.entry[${ei}]`);

    for (let ci = 0; ci < changes.length; ci++) {
      const change = assertRecord(changes[ci], "whatsapp", `payload.entry[${ei}].changes[${ci}]`);
      const value = getRequiredRecord(change, "value", "whatsapp", `payload.entry[${ei}].changes[${ci}]`);

      const messagesValue = value.messages;
      if (!Array.isArray(messagesValue) || messagesValue.length === 0) {
        continue;
      }

      const metadata = getRequiredRecord(value, "metadata", "whatsapp", `payload.entry[${ei}].changes[${ci}].value`);
      const phoneNumberId = getRequiredString(metadata, "phone_number_id", "whatsapp", `payload.entry[${ei}].changes[${ci}].value.metadata`);

      for (let mi = 0; mi < messagesValue.length; mi++) {
        const message = assertRecord(messagesValue[mi], "whatsapp", `payload.entry[${ei}].changes[${ci}].value.messages[${mi}]`);
        const contact = getOptionalArrayItem(value, "contacts", 0);
        const profile = contact ? getOptionalRecord(contact, "profile") : undefined;
        const text = getOptionalRecord(message, "text");

        results.push(buildNormalisedMessage({
          channel: "whatsapp",
          clientId,
          from: {
            id: getRequiredString(message, "from", "whatsapp", `payload.entry[${ei}].changes[${ci}].value.messages[${mi}]`),
            name: profile ? getOptionalString(profile, "name") : undefined,
          },
          to: { id: phoneNumberId },
          content: {
            type: getSupportedContentType(message.type),
            text: text ? getOptionalString(text, "body") : undefined,
          },
          timestamp: getIsoTimestamp(message.timestamp, "whatsapp", `payload.entry[${ei}].changes[${ci}].value.messages[${mi}].timestamp`),
          raw: root,
        }));
      }
    }
  }

  return results;
}

export function normaliseFacebook(
  payload: unknown,
  clientId?: string,
): NormalisedMessage[] {
  const root = assertRecord(payload, "facebook", "payload");
  const entries = getRequiredArray(root, "entry", "facebook", "payload");
  const results: NormalisedMessage[] = [];

  for (let ei = 0; ei < entries.length; ei++) {
    const entry = assertRecord(entries[ei], "facebook", `payload.entry[${ei}]`);
    const messagingItems = getRequiredArray(entry, "messaging", "facebook", `payload.entry[${ei}]`);

    for (let mi = 0; mi < messagingItems.length; mi++) {
      const messaging = assertRecord(messagingItems[mi], "facebook", `payload.entry[${ei}].messaging[${mi}]`);
      const sender = getRequiredRecord(messaging, "sender", "facebook", `payload.entry[${ei}].messaging[${mi}]`);
      const recipient = getRequiredRecord(messaging, "recipient", "facebook", `payload.entry[${ei}].messaging[${mi}]`);
      const message = getOptionalRecord(messaging, "message");

      results.push(buildNormalisedMessage({
        channel: "facebook",
        clientId,
        from: { id: getRequiredString(sender, "id", "facebook", `payload.entry[${ei}].messaging[${mi}].sender`) },
        to: { id: getRequiredString(recipient, "id", "facebook", `payload.entry[${ei}].messaging[${mi}].recipient`) },
        content: {
          type: "text",
          text: message ? getOptionalString(message, "text") : undefined,
        },
        timestamp: getIsoTimestamp(messaging.timestamp, "facebook", `payload.entry[${ei}].messaging[${mi}].timestamp`),
        raw: root,
      }));
    }
  }

  return results;
}

export function normaliseWebsite(
  payload: unknown,
  clientId: string,
): NormalisedMessage {
  const root = assertRecord(payload, "website", "payload");
  const sessionId = getRequiredString(root, "session_id", "website", "payload");
  const name = getOptionalString(root, "name");
  const message = getOptionalString(root, "message");

  return buildNormalisedMessage({
    channel: "website",
    clientId,
    from: {
      id: sessionId,
      name,
    },
    to: {
      id: clientId,
    },
    content: {
      type: "text",
      text: message,
    },
    timestamp: new Date().toISOString(),
    raw: root,
  });
}
