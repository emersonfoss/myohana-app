// server/groupme.ts
// GroupMe API integration — bot registration, webhook ingestion, message posting, backfill

import type { InsertChatMessage } from "@shared/schema";

const GROUPME_API = "https://api.groupme.com/v3";

export interface GroupMeMessage {
  id: string;
  source_guid: string;
  created_at: number; // Unix timestamp
  user_id: string;
  group_id: string;
  name: string; // sender display name
  avatar_url?: string;
  text: string | null;
  system: boolean;
  favorited_by: string[];
  attachments: GroupMeAttachment[];
}

export interface GroupMeAttachment {
  type: "image" | "video" | "location" | "emoji" | "reply" | "mentions";
  url?: string;
  lat?: number;
  lng?: number;
  name?: string;
}

/** Returns true when the GROUPME_ACCESS_TOKEN env var is present. */
export function isGroupMeConfigured(): boolean {
  return !!process.env.GROUPME_ACCESS_TOKEN;
}

/** List user's groups. */
export async function listGroups(
  accessToken: string,
): Promise<{ id: string; name: string; member_count: number }[]> {
  const response = await fetch(
    `${GROUPME_API}/groups?token=${accessToken}&per_page=50`,
  );
  if (!response.ok) throw new Error(`GroupMe API error: ${response.status}`);
  const data = (await response.json()) as { response: any[] };
  return data.response.map((g: any) => ({
    id: g.id,
    name: g.name,
    member_count: g.members?.length || 0,
  }));
}

/** Register a bot in the group. Returns bot_id. */
export async function registerBot(
  accessToken: string,
  groupId: string,
  botName: string,
  callbackUrl: string,
): Promise<string> {
  const response = await fetch(`${GROUPME_API}/bots?token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot: {
        name: botName,
        group_id: groupId,
        callback_url: callbackUrl,
      },
    }),
  });
  if (!response.ok)
    throw new Error(`Failed to register GroupMe bot: ${await response.text()}`);
  const data = (await response.json()) as {
    response: { bot: { bot_id: string } };
  };
  return data.response.bot.bot_id;
}

/** Destroy a bot. */
export async function destroyBot(
  accessToken: string,
  botId: string,
): Promise<void> {
  await fetch(`${GROUPME_API}/bots/destroy?token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: botId }),
  });
}

/** Post a message to the group via bot. */
export async function postBotMessage(
  botId: string,
  text: string,
): Promise<void> {
  await fetch(`${GROUPME_API}/bots/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: botId, text }),
  });
}

/** Fetch historical messages (for backfill). Returns up to 100 per page, newest first. */
export async function fetchMessages(
  accessToken: string,
  groupId: string,
  beforeId?: string,
): Promise<{ messages: GroupMeMessage[]; count: number }> {
  const params = new URLSearchParams({
    token: accessToken,
    limit: "100",
  });
  if (beforeId) params.set("before_id", beforeId);

  const response = await fetch(
    `${GROUPME_API}/groups/${groupId}/messages?${params}`,
  );
  if (!response.ok)
    throw new Error(`Failed to fetch GroupMe messages: ${response.status}`);
  const data = (await response.json()) as {
    response: { count: number; messages: GroupMeMessage[] };
  };
  return data.response;
}

/**
 * Normalize a GroupMe message into an InsertChatMessage shape.
 * Image attachment URLs are appended to the text content rather than imported as photos.
 * Maps: externalId ← msg.id, createdAt ← msg.created_at (converted), platform ← "groupme"
 */
export function normalizeGroupMeMessage(
  msg: GroupMeMessage,
  familyId: number,
): InsertChatMessage | null {
  // Skip system messages (join/leave)
  if (msg.system) return null;

  const imageUrls = msg.attachments
    .filter((a) => a.type === "image" && a.url)
    .map((a) => a.url!);

  // Build content: text + image URLs
  const parts: string[] = [];
  if (msg.text) parts.push(msg.text);
  for (const url of imageUrls) {
    parts.push(url);
  }

  const content = parts.join("\n");
  if (!content) return null; // Skip empty messages

  return {
    familyId,
    senderName: msg.name,
    platform: "groupme",
    content,
    externalId: msg.id,
    importedAt: new Date().toISOString(),
  };
}
