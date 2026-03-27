import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// Set SESSION_SECRET before importing routes
process.env.SESSION_SECRET = "test-secret-key-for-vault-tests-1234567890abcdef";

const dbFiles = ["data.db", "data.db-shm", "data.db-wal", "sessions.db", "sessions.db-shm", "sessions.db-wal"];
function cleanupDb() {
  for (const f of dbFiles) {
    try { fs.unlinkSync(f); } catch {}
  }
}

function cleanupVaultUploads() {
  const dir = path.join(process.cwd(), "vault-uploads");
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function createTables() {
  const db = new Database("data.db");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      age INTEGER,
      date_of_birth TEXT,
      emoji TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      recipient_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS vault_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      uploaded_by_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      expires_at TEXT,
      file_url TEXT,
      file_key TEXT,
      file_size INTEGER,
      mime_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      location TEXT,
      member_ids TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      added_by_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL,
      approved_for_ages TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS thinking_of_you (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      uploaded_by_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      caption TEXT,
      taken_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      member_id INTEGER,
      role TEXT NOT NULL DEFAULT 'parent',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_by_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      latitude TEXT NOT NULL,
      longitude TEXT NOT NULL,
      address TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      sender_name TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'internal',
      content TEXT NOT NULL,
      external_id TEXT,
      imported_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS memory_atoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      member_ids TEXT,
      created_by_id INTEGER,
      category TEXT NOT NULL DEFAULT 'daily_life',
      emotional_tone TEXT NOT NULL DEFAULT 'joyful',
      occurred_at TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS memory_compilations (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      narrative TEXT,
      cover_atom_id INTEGER,
      atom_ids TEXT,
      perspective_member_id INTEGER,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      family_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      plan TEXT NOT NULL DEFAULT 'family',
      price_monthly INTEGER NOT NULL DEFAULT 1999,
      started_at TEXT NOT NULL,
      expires_at TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.close();
}

let app: express.Express;
let httpServer: ReturnType<typeof createServer>;

function agentWithIp(ip: string) {
  const agent = supertest.agent(app);
  const origPost = agent.post.bind(agent);
  const origGet = agent.get.bind(agent);
  const origDelete = agent.delete.bind(agent);
  agent.post = (url: string) => origPost(url).set("X-Forwarded-For", ip);
  agent.get = (url: string) => origGet(url).set("X-Forwarded-For", ip);
  agent.delete = (url: string) => origDelete(url).set("X-Forwarded-For", ip);
  return agent;
}

async function registerAndLogin(ip: string, email: string, name: string, familyName?: string) {
  const agent = agentWithIp(ip);
  await agent.post("/api/auth/register").send({
    familyName: familyName || "Vault Test Family",
    email,
    password: "password123",
    name,
  });
  return agent;
}

beforeAll(async () => {
  cleanupDb();
  cleanupVaultUploads();
  createTables();

  app = express();
  app.set("trust proxy", true);
  httpServer = createServer(app);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const { registerRoutes } = await import("../../server/routes");
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });
});

afterAll(() => {
  httpServer.close();
  cleanupDb();
  cleanupVaultUploads();
});

// Create a small PDF-like buffer for testing
function createTestPdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4 test content for vault upload testing");
}

function createTestPngBuffer(): Buffer {
  // Minimal PNG header
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    // IHDR chunk
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  ]);
  return pngHeader;
}

// ─── Vault File Upload Tests ─────────────────────────────────────────

describe("Vault File Storage", () => {
  let agent: ReturnType<typeof agentWithIp>;
  let csrfToken: string;
  let createdDocId: number;
  let metadataDocId: number;
  let familyId: number;
  let memberId: number;

  beforeAll(async () => {
    agent = await registerAndLogin("10.30.0.1", "vault@example.com", "Vault User");
    const csrfRes = await agent.get("/api/csrf-token");
    csrfToken = csrfRes.body.csrfToken;

    // Get the authenticated user's familyId
    const meRes = await agent.get("/api/auth/me");
    familyId = meRes.body.familyId;
    memberId = meRes.body.memberId || meRes.body.id;
  });

  it("should upload a PDF file to vault", async () => {
    const pdfBuffer = createTestPdfBuffer();

    const res = await agent
      .post("/api/vault")
      .set("x-csrf-token", csrfToken)
      .field("familyId", String(familyId))
      .field("uploadedById", String(memberId))
      .field("name", "Test PDF Document")
      .field("category", "legal")
      .field("description", "Test upload")
      .attach("file", pdfBuffer, { filename: "test.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe("Test PDF Document");
    expect(res.body.fileKey).toBeTruthy();
    expect(res.body.fileSize).toBeGreaterThan(0);
    expect(res.body.mimeType).toBe("application/pdf");
    createdDocId = res.body.id;
  });

  it("should create metadata-only vault entry (no file)", async () => {
    const res = await agent
      .post("/api/vault")
      .set("x-csrf-token", csrfToken)
      .field("familyId", String(familyId))
      .field("uploadedById", String(memberId))
      .field("name", "Metadata Only Doc")
      .field("category", "health");

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Metadata Only Doc");
    expect(res.body.fileKey).toBeNull();
    expect(res.body.fileSize).toBeNull();
    metadataDocId = res.body.id;
  });

  it("should download a vault document file", async () => {
    const res = await agent.get(`/api/vault/${createdDocId}/download`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("downloadUrl");
    expect(res.body.downloadUrl).toBeTruthy();
  });

  it("should return 404 for download of metadata-only document", async () => {
    const res = await agent.get(`/api/vault/${metadataDocId}/download`);
    expect(res.status).toBe(404);
  });

  it("should reject disallowed file types (e.g., .exe)", async () => {
    const exeBuffer = Buffer.from("MZ fake exe content");

    const res = await agent
      .post("/api/vault")
      .set("x-csrf-token", csrfToken)
      .field("familyId", String(familyId))
      .field("uploadedById", String(memberId))
      .field("name", "Bad File")
      .field("category", "legal")
      .attach("file", exeBuffer, { filename: "malware.exe", contentType: "application/x-msdownload" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not allowed|Accepted/i);
  });

  it("should reject files larger than 25MB", async () => {
    // Create a buffer just over 25MB
    const largeBuffer = Buffer.alloc(25 * 1024 * 1024 + 1, "x");

    const res = await agent
      .post("/api/vault")
      .set("x-csrf-token", csrfToken)
      .field("familyId", String(familyId))
      .field("uploadedById", String(memberId))
      .field("name", "Huge File")
      .field("category", "financial")
      .attach("file", largeBuffer, { filename: "huge.pdf", contentType: "application/pdf" });

    // Multer should reject with 400 or 413
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("should delete vault document with file", async () => {
    const res = await agent
      .delete(`/api/vault/${createdDocId}`)
      .set("x-csrf-token", csrfToken);

    expect(res.status).toBe(204);

    // Verify document is gone
    const downloadRes = await agent.get(`/api/vault/${createdDocId}/download`);
    expect(downloadRes.status).toBe(404);
  });

  it("should upload a PNG image to vault", async () => {
    const pngBuffer = createTestPngBuffer();

    const res = await agent
      .post("/api/vault")
      .set("x-csrf-token", csrfToken)
      .field("familyId", String(familyId))
      .field("uploadedById", String(memberId))
      .field("name", "ID Photo")
      .field("category", "identity")
      .attach("file", pngBuffer, { filename: "id-photo.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe("image/png");
  });
});

// ─── Cross-Family Access Tests ───────────────────────────────────────

describe("Vault Cross-Family Access", () => {
  let agent1: ReturnType<typeof agentWithIp>;
  let agent2: ReturnType<typeof agentWithIp>;
  let csrfToken1: string;
  let docId: number;

  beforeAll(async () => {
    agent1 = await registerAndLogin("10.31.0.1", "family1@example.com", "Family1 User", "Family One");
    const csrf1 = await agent1.get("/api/csrf-token");
    csrfToken1 = csrf1.body.csrfToken;

    agent2 = await registerAndLogin("10.31.0.2", "family2@example.com", "Family2 User", "Family Two");

    // Create a document as family1 using the authenticated user's familyId
    const meRes = await agent1.get("/api/auth/me");
    const familyId = meRes.body.familyId;
    const memberId = meRes.body.memberId || meRes.body.id;

    const createRes = await agent1
      .post("/api/vault")
      .set("x-csrf-token", csrfToken1)
      .field("familyId", String(familyId))
      .field("uploadedById", String(memberId))
      .field("name", "Private Doc")
      .field("category", "legal")
      .attach("file", createTestPdfBuffer(), { filename: "private.pdf", contentType: "application/pdf" });

    docId = createRes.body.id;
  });

  it("should deny cross-family download", async () => {
    const res = await agent2.get(`/api/vault/${docId}/download`);
    expect(res.status).toBe(403);
  });
});
