// server/google-photos.ts
// Google Photos Picker API integration
// API Reference: https://developers.google.com/photos/picker/reference/rest

import { getValidAccessToken } from "./google-auth";
import { uploadFile, buildFileKey, isS3Configured } from "./storage-s3";
import { storage } from "./storage";
import { memoryEngine } from "./memory-engine";
import type { Photo, FamilyMember } from "@shared/schema";

const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig: {
    pollInterval: string; // e.g. "5s"
    timeoutIn: string; // e.g. "900s"
  };
  mediaItemsSet?: boolean;
}

export interface PickerMediaItem {
  id: string;
  createTime: string;
  type: "PHOTO" | "VIDEO";
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
  };
}

/** Step 1: Create a picker session — returns pickerUri for the frontend. */
export async function createPickerSession(userId: number): Promise<PickerSession> {
  const accessToken = await getValidAccessToken(userId);

  const response = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Google Photos picker session: ${error}`);
  }

  return response.json() as Promise<PickerSession>;
}

/** Step 2: Poll session until mediaItemsSet = true. */
export async function pollPickerSession(userId: number, sessionId: string): Promise<PickerSession> {
  const accessToken = await getValidAccessToken(userId);

  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to poll picker session: ${await response.text()}`);
  }

  return response.json() as Promise<PickerSession>;
}

/** Step 3: List media items selected in the picker session. */
export async function listPickerMediaItems(
  userId: number,
  sessionId: string,
  pageToken?: string,
): Promise<{ mediaItems: PickerMediaItem[]; nextPageToken?: string }> {
  const accessToken = await getValidAccessToken(userId);

  const params = new URLSearchParams({ sessionId });
  if (pageToken) params.set("pageToken", pageToken);

  const response = await fetch(`${PICKER_API_BASE}/mediaItems?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to list picker media items: ${await response.text()}`);
  }

  return response.json() as Promise<{ mediaItems: PickerMediaItem[]; nextPageToken?: string }>;
}

/** Step 4: Download a single photo and import it into MyOhana. */
export async function importPickerItem(
  item: PickerMediaItem,
  userId: number,
  familyId: number,
  familyMembers: FamilyMember[],
): Promise<Photo | null> {
  if (item.type === "VIDEO") return null; // Skip videos for now

  const imageUrl = `${item.mediaFile.baseUrl}=d`; // =d suffix downloads original quality

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) return null;

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const mimeType = item.mediaFile.mimeType;
  const ext = mimeType.split("/")[1] || "jpg";

  // Upload using the existing storage-s3 abstraction
  const key = buildFileKey(familyId, `gphotos-${item.id}.${ext}`);
  const photoUrl = await uploadFile(key, buffer, mimeType);

  // Create Photo record via storage abstraction
  const photo = await storage.createPhoto({
    familyId,
    uploadedById: userId,
    url: photoUrl,
    caption: null,
    takenAt: item.createTime ? new Date(item.createTime).toISOString() : null,
    source: "google_photos",
    externalId: item.id,
    filename: item.mediaFile.filename,
    mimeType,
  });

  // Auto-ingest as Memory Atom (fire-and-forget)
  memoryEngine.ingestPhoto(photo, familyMembers).catch(() => {});

  return photo;
}

/** Full import flow: list all items from session, download and import each. */
export async function importAllPickerItems(
  userId: number,
  familyId: number,
  sessionId: string,
  familyMembers: FamilyMember[],
): Promise<{ imported: number; skipped: number; errors: number }> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let pageToken: string | undefined;

  do {
    const result = await listPickerMediaItems(userId, sessionId, pageToken);
    const mediaItems = result.mediaItems || [];
    pageToken = result.nextPageToken;

    for (const item of mediaItems) {
      try {
        const photo = await importPickerItem(item, userId, familyId, familyMembers);
        if (photo) imported++;
        else skipped++;
      } catch {
        errors++;
      }
    }
  } while (pageToken);

  return { imported, skipped, errors };
}
