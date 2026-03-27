import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express from "express";
import { createServer } from "http";
import fs from "fs";
import Database from "better-sqlite3";

process.env.SESSION_SECRET = "test-secret-key-for-multi-family-tests-1234567890";

const dbFiles = ["data.db", "data.db-shm", "data.db-wal", "sessions.db", "sessions.db-shm", "sessions.db-wal"];
function cleanupDb() {
  for (const f of dbFiles) {
    try { fs.unlinkSync(f); } catch {}
  }
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

// Helpers to register and get CSRF token for an agent
async function registerUser(agent: ReturnType<typeof agentWithIp>, familyName: string, email: string, name: string) {
  const res = await agent.post("/api/auth/register").send({
    familyName,
    email,
    password: "password123",
    name,
  });
  return res.body;
}

async function getCsrfToken(agent: ReturnType<typeof agentWithIp>) {
  const res = await agent.get("/api/csrf-token");
  return res.body.csrfToken as string;
}

let agentA: ReturnType<typeof agentWithIp>;
let agentB: ReturnType<typeof agentWithIp>;
let userA: any;
let userB: any;
let csrfA: string;
let csrfB: string;

beforeAll(async () => {
  cleanupDb();
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

  // Register Family A
  agentA = agentWithIp("10.10.0.1");
  userA = await registerUser(agentA, "Family Alpha", "alpha@test.com", "Alice Alpha");
  csrfA = await getCsrfToken(agentA);

  // Register Family B
  agentB = agentWithIp("10.10.0.2");
  userB = await registerUser(agentB, "Family Beta", "beta@test.com", "Bob Beta");
  csrfB = await getCsrfToken(agentB);
});

afterAll(() => {
  httpServer.close();
  cleanupDb();
});

// ─── Multi-Family Data Isolation Tests ──────────────────────────────────

describe("Multi-family data isolation", () => {
  let messageA: any;
  let vaultDocA: any;

  it("Family A can create a message", async () => {
    const res = await agentA
      .post("/api/messages")
      .set("x-csrf-token", csrfA)
      .send({
        familyId: userA.familyId,
        authorId: userA.memberId,
        title: "Alpha Private Message",
        content: "This is a private message for Family Alpha",
        type: "text",
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Alpha Private Message");
    messageA = res.body;
  });

  it("Family B cannot see Family A's messages", async () => {
    const res = await agentB.get("/api/messages");
    expect(res.status).toBe(200);
    const titles = res.body.map((m: any) => m.title);
    expect(titles).not.toContain("Alpha Private Message");
  });

  it("Family A can see its own messages", async () => {
    const res = await agentA.get("/api/messages");
    expect(res.status).toBe(200);
    const titles = res.body.map((m: any) => m.title);
    expect(titles).toContain("Alpha Private Message");
  });

  it("Family A can create a vault document", async () => {
    const res = await agentA
      .post("/api/vault")
      .set("x-csrf-token", csrfA)
      .send({
        familyId: userA.familyId,
        uploadedById: userA.memberId,
        name: "Alpha Insurance",
        category: "insurance",
        description: "Family Alpha insurance document",
      });

    expect(res.status).toBe(201);
    vaultDocA = res.body;
  });

  it("Family B cannot see Family A's vault documents", async () => {
    const res = await agentB.get("/api/vault");
    expect(res.status).toBe(200);
    const names = res.body.map((d: any) => d.name);
    expect(names).not.toContain("Alpha Insurance");
  });

  it("Family B cannot delete Family A's vault document — returns 403", async () => {
    const res = await agentB
      .delete(`/api/vault/${vaultDocA.id}`)
      .set("x-csrf-token", csrfB);

    expect(res.status).toBe(403);
  });

  it("Family A can create a photo", async () => {
    const res = await agentA
      .post("/api/photos")
      .set("x-csrf-token", csrfA)
      .send({
        familyId: userA.familyId,
        uploadedById: userA.memberId,
        url: "/uploads/alpha-photo.jpg",
        caption: "Alpha family photo",
      });

    expect(res.status).toBe(201);
    expect(res.body.caption).toBe("Alpha family photo");
  });

  it("Family B cannot see Family A's photos", async () => {
    const res = await agentB.get("/api/photos");
    expect(res.status).toBe(200);
    const captions = res.body.map((p: any) => p.caption);
    expect(captions).not.toContain("Alpha family photo");
  });

  it("Both families can see their own data independently", async () => {
    // Family B creates its own message
    const bRes = await agentB
      .post("/api/messages")
      .set("x-csrf-token", csrfB)
      .send({
        familyId: userB.familyId,
        authorId: userB.memberId,
        title: "Beta Private Message",
        content: "This is a private message for Family Beta",
        type: "text",
      });
    expect(bRes.status).toBe(201);

    // Family A sees only its own
    const aMessages = await agentA.get("/api/messages");
    expect(aMessages.body.some((m: any) => m.title === "Alpha Private Message")).toBe(true);
    expect(aMessages.body.some((m: any) => m.title === "Beta Private Message")).toBe(false);

    // Family B sees only its own
    const bMessages = await agentB.get("/api/messages");
    expect(bMessages.body.some((m: any) => m.title === "Beta Private Message")).toBe(true);
    expect(bMessages.body.some((m: any) => m.title === "Alpha Private Message")).toBe(false);
  });

  it("Family B cannot delete Family A's media item — returns 403", async () => {
    // Create a media item for Family A
    const createRes = await agentA
      .post("/api/media")
      .set("x-csrf-token", csrfA)
      .send({
        familyId: userA.familyId,
        addedById: userA.memberId,
        title: "Alpha Video",
        url: "https://example.com/video",
        type: "youtube",
      });
    expect(createRes.status).toBe(201);

    const deleteRes = await agentB
      .delete(`/api/media/${createRes.body.id}`)
      .set("x-csrf-token", csrfB);

    expect(deleteRes.status).toBe(403);
  });

  it("Family scoping applies to calendar events", async () => {
    await agentA
      .post("/api/calendar")
      .set("x-csrf-token", csrfA)
      .send({
        familyId: userA.familyId,
        title: "Alpha Family Dinner",
        startDate: new Date().toISOString(),
      });

    const aEvents = await agentA.get("/api/calendar");
    expect(aEvents.body.some((e: any) => e.title === "Alpha Family Dinner")).toBe(true);

    const bEvents = await agentB.get("/api/calendar");
    expect(bEvents.body.some((e: any) => e.title === "Alpha Family Dinner")).toBe(false);
  });

  it("Family scoping applies to chat messages", async () => {
    await agentA
      .post("/api/chat")
      .set("x-csrf-token", csrfA)
      .send({
        familyId: userA.familyId,
        senderName: "Alice",
        content: "Alpha chat message",
      });

    const aChat = await agentA.get("/api/chat");
    expect(aChat.body.some((m: any) => m.content === "Alpha chat message")).toBe(true);

    const bChat = await agentB.get("/api/chat");
    expect(bChat.body.some((m: any) => m.content === "Alpha chat message")).toBe(false);
  });

  it("Server enforces familyId from session, not request body", async () => {
    // Family B tries to create a message with Family A's familyId
    const res = await agentB
      .post("/api/messages")
      .set("x-csrf-token", csrfB)
      .send({
        familyId: userA.familyId, // trying to spoof A's familyId
        authorId: userB.memberId,
        title: "Spoofed Message",
        content: "Trying to inject into Family A",
        type: "text",
      });

    expect(res.status).toBe(201);
    // The message should be created under Family B's ID, not A's
    expect(res.body.familyId).toBe(userB.familyId);

    // Verify Family A doesn't see it
    const aMessages = await agentA.get("/api/messages");
    expect(aMessages.body.some((m: any) => m.title === "Spoofed Message")).toBe(false);
  });
});
