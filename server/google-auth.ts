// server/google-auth.ts
// Google OAuth 2.0 flow for Google Photos Picker API

import { google } from "googleapis";
import { storage } from "./storage";

const SCOPES = [
  // Picker API scope (replaces deprecated photoslibrary.readonly)
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
];

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/** Returns true when all three GOOGLE_* env vars are present. */
export function isGoogleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

/** Generate OAuth authorization URL with user ID encoded in state. */
export function getGoogleAuthUrl(userId: number): string {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: Buffer.from(JSON.stringify({ userId })).toString("base64"),
  });
}

/** Exchange authorization code for tokens and persist via storage. */
export async function exchangeGoogleCode(
  code: string,
  userId: number,
  familyId: number,
): Promise<void> {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString();

  await storage.saveGoogleToken({
    userId,
    familyId,
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token || null,
    expiresAt,
    scope: SCOPES.join(" "),
    tokenType: "Bearer",
  });
}

/** Get a valid access token — auto-refreshes if expired. */
export async function getValidAccessToken(userId: number): Promise<string> {
  const tokenRow = await storage.getGoogleToken(userId);
  if (!tokenRow) throw new Error("Google account not connected");

  // 1-minute buffer before expiry
  const isExpired = new Date(tokenRow.expiresAt) <= new Date(Date.now() + 60_000);

  if (!isExpired) return tokenRow.accessToken;

  if (!tokenRow.refreshToken) {
    throw new Error("Google token expired and no refresh token available. Reconnect Google account.");
  }

  // Refresh the token
  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({ refresh_token: tokenRow.refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();

  const newExpiry = credentials.expiry_date
    ? new Date(credentials.expiry_date).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString();

  await storage.saveGoogleToken({
    userId,
    familyId: tokenRow.familyId,
    accessToken: credentials.access_token!,
    refreshToken: tokenRow.refreshToken,
    expiresAt: newExpiry,
    scope: tokenRow.scope,
    tokenType: "Bearer",
  });

  return credentials.access_token!;
}

/** Check if user has connected Google account. */
export async function isGoogleConnected(userId: number): Promise<boolean> {
  const row = await storage.getGoogleToken(userId);
  return !!row;
}

/** Disconnect Google account for a user. */
export async function disconnectGoogle(userId: number): Promise<void> {
  await storage.deleteGoogleToken(userId);
}
