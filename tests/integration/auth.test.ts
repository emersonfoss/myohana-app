import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express from "express";
import { createServer } from "http";
import fs from "fs";
import Database from "better-sqlite3";

// Set SESSION_SECRET before importing routes
process.env.SESSION_SECRET = "test-secret-key-for-integration-tests-1234567890";

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

/**
 * Helper: create an agent with a specific IP to isolate from rate limiting.
 * Uses X-Forwarded-For header which Express respects with trust proxy enabled.
 */
function agentWithIp(ip: string) {
  const agent = supertest.agent(app);
  // Monkey-patch the agent to always set X-Forwarded-For
  const origPost = agent.post.bind(agent);
  const origGet = agent.get.bind(agent);
  agent.post = (url: string) => origPost(url).set("X-Forwarded-For", ip);
  agent.get = (url: string) => origGet(url).set("X-Forwarded-For", ip);
  return agent;
}

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
});

afterAll(() => {
  httpServer.close();
  cleanupDb();
});

// ─── Register Tests ──────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("should register a new user successfully", async () => {
    const agent = agentWithIp("10.1.0.1");
    const res = await agent
      .post("/api/auth/register")
      .send({
        familyName: "Test Family",
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.email).toBe("test@example.com");
    expect(res.body.name).toBe("Test User");
    expect(res.body.role).toBe("admin");
  });

  it("should reject duplicate email", async () => {
    const agent = agentWithIp("10.1.0.2");
    const res = await agent
      .post("/api/auth/register")
      .send({
        familyName: "Another Family",
        email: "test@example.com",
        password: "password456",
        name: "Another User",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it("should reject missing fields", async () => {
    const agent = agentWithIp("10.1.0.3");
    const res = await agent
      .post("/api/auth/register")
      .send({ email: "partial@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });
});

// ─── Login Tests ─────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("should login with valid credentials", async () => {
    const agent = agentWithIp("10.2.0.1");
    const res = await agent
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("test@example.com");
  });

  it("should reject wrong password", async () => {
    const agent = agentWithIp("10.2.0.2");
    const res = await agent
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("should reject non-existent email", async () => {
    const agent = agentWithIp("10.2.0.3");
    const res = await agent
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });
});

// ─── Logout Tests ────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("should logout successfully when authenticated", async () => {
    const agent = agentWithIp("10.3.0.1");
    await agent.post("/api/auth/register").send({
      familyName: "Logout Family",
      email: "logout@example.com",
      password: "password123",
      name: "Logout User",
    });

    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });

  it("should return 200 even when not authenticated", async () => {
    const agent = agentWithIp("10.3.0.2");
    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(200);
  });
});

// ─── Me Tests ────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("should return user when authenticated", async () => {
    const agent = agentWithIp("10.4.0.1");
    await agent.post("/api/auth/register").send({
      familyName: "Me Family",
      email: "me@example.com",
      password: "password123",
      name: "Me User",
    });

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("me@example.com");
  });

  it("should return 401 when not authenticated", async () => {
    const agent = agentWithIp("10.4.0.2");
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

// ─── Invite Tests ────────────────────────────────────────────────────

describe("POST /api/auth/invite", () => {
  it("should generate invite code for parent/admin", async () => {
    const agent = agentWithIp("10.5.0.1");
    await agent.post("/api/auth/register").send({
      familyName: "Invite Family",
      email: "invite@example.com",
      password: "password123",
      name: "Invite User",
    });

    const csrfRes = await agent.get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const res = await agent
      .post("/api/auth/invite")
      .set("x-csrf-token", csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("inviteCode");
    expect(typeof res.body.inviteCode).toBe("string");
  });

  it("should reject for unauthenticated user", async () => {
    const agent = agentWithIp("10.5.0.2");
    const res = await agent.post("/api/auth/invite").send({});
    expect(res.status).toBe(401);
  });
});

// ─── Join Tests ──────────────────────────────────────────────────────

describe("POST /api/auth/join", () => {
  let inviteCode: string;

  beforeAll(async () => {
    const agent = agentWithIp("10.6.0.1");
    await agent.post("/api/auth/register").send({
      familyName: "Join Family",
      email: "joiner-admin@example.com",
      password: "password123",
      name: "Join Admin",
    });

    const csrfRes = await agent.get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const inviteRes = await agent
      .post("/api/auth/invite")
      .set("x-csrf-token", csrfToken)
      .send({});
    inviteCode = inviteRes.body.inviteCode;
  });

  it("should join with valid invite code", async () => {
    const agent = agentWithIp("10.6.0.2");
    const res = await agent
      .post("/api/auth/join")
      .send({
        inviteCode,
        email: "newmember@example.com",
        password: "password123",
        name: "New Member",
        role: "parent",
      });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("newmember@example.com");
    expect(res.body.name).toBe("New Member");
  });

  it("should reject invalid invite code", async () => {
    const agent = agentWithIp("10.6.0.3");
    const res = await agent
      .post("/api/auth/join")
      .send({
        inviteCode: "invalid-code-12345",
        email: "another@example.com",
        password: "password123",
        name: "Another User",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid invite/i);
  });
});

// ─── Rate Limiting Test (LAST — depletes the rate limit) ─────────────

describe("Rate limiting", () => {
  it("should return 429 after 5 failed login attempts", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await supertest(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "10.99.99.99")
        .send({ email: "bruteforce@example.com", password: "wrong" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
