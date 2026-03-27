import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express from "express";
import { createServer } from "http";
import fs from "fs";
import Database from "better-sqlite3";

// Set SESSION_SECRET before importing routes
process.env.SESSION_SECRET = "test-secret-key-for-account-tests-1234567890abc";

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
    familyName: familyName || "Test Family",
    email,
    password: "password123",
    name,
  });
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

// ─── Change Password Tests ─────────────────────────────────────────

describe("POST /api/auth/change-password", () => {
  it("should change password successfully", async () => {
    const agent = await registerAndLogin("10.20.0.1", "changepw@example.com", "ChangePW User");
    const csrfRes = await agent.get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const res = await agent
      .post("/api/auth/change-password")
      .set("x-csrf-token", csrfToken)
      .send({ currentPassword: "password123", newPassword: "newpassword456" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/changed/i);

    // Verify login with new password works
    await agent.post("/api/auth/logout");
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email: "changepw@example.com", password: "newpassword456" });
    expect(loginRes.status).toBe(200);
  });

  it("should reject wrong current password", async () => {
    const agent = await registerAndLogin("10.20.0.2", "wrongcurrent@example.com", "WrongCurrent User");
    const csrfRes = await agent.get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const res = await agent
      .post("/api/auth/change-password")
      .set("x-csrf-token", csrfToken)
      .send({ currentPassword: "wrongpassword", newPassword: "newpassword456" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/incorrect/i);
  });
});

// ─── Password Reset Token Tests ─────────────────────────────────────

describe("Password Reset Flow", () => {
  it("should request a reset token", async () => {
    const agent = await registerAndLogin("10.21.0.1", "reset@example.com", "Reset User");
    await agent.post("/api/auth/logout");

    const resetAgent = agentWithIp("10.21.0.2");
    const res = await resetAgent
      .post("/api/auth/forgot-password")
      .send({ email: "reset@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link/i);
  });

  it("should return success even for non-existent email", async () => {
    const agent = agentWithIp("10.21.0.3");
    const res = await agent
      .post("/api/auth/forgot-password")
      .send({ email: "nonexistent@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link/i);
  });

  it("should reset password with valid token", async () => {
    // Register a user first
    const agent = await registerAndLogin("10.21.1.1", "resetvalid@example.com", "ResetValid User");
    await agent.post("/api/auth/logout");

    // Request a password reset
    const resetAgent = agentWithIp("10.21.1.2");
    await resetAgent
      .post("/api/auth/forgot-password")
      .send({ email: "resetvalid@example.com" });

    // Get the token from the DB directly
    const db = new Database("data.db");
    const tokenRow = db.prepare("SELECT token FROM password_reset_tokens WHERE user_id = (SELECT id FROM users WHERE email = ?)").get("resetvalid@example.com") as any;
    db.close();

    expect(tokenRow).toBeTruthy();

    // Use the token to reset password
    const res = await resetAgent
      .post("/api/auth/reset-password")
      .send({ token: tokenRow.token, newPassword: "resetted123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset successfully/i);

    // Verify login with new password
    const loginRes = await resetAgent
      .post("/api/auth/login")
      .send({ email: "resetvalid@example.com", password: "resetted123" });
    expect(loginRes.status).toBe(200);
  });

  it("should reject expired token", async () => {
    const agent = await registerAndLogin("10.21.2.1", "expired@example.com", "Expired User");
    await agent.post("/api/auth/logout");

    // Insert an expired token directly
    const db = new Database("data.db");
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get("expired@example.com") as any;
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    db.prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)").run(user.id, "expired-token-123", pastDate);
    db.close();

    const resetAgent = agentWithIp("10.21.2.2");
    const res = await resetAgent
      .post("/api/auth/reset-password")
      .send({ token: "expired-token-123", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("should reject invalid token", async () => {
    const agent = agentWithIp("10.21.3.1");
    const res = await agent
      .post("/api/auth/reset-password")
      .send({ token: "totally-invalid-token", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("should reject used token", async () => {
    const agent = await registerAndLogin("10.21.4.1", "usedtoken@example.com", "UsedToken User");
    await agent.post("/api/auth/logout");

    // Insert a used token directly
    const db = new Database("data.db");
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get("usedtoken@example.com") as any;
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    db.prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at, used_at) VALUES (?, ?, ?, ?)").run(user.id, "used-token-456", futureDate, new Date().toISOString());
    db.close();

    const resetAgent = agentWithIp("10.21.4.2");
    const res = await resetAgent
      .post("/api/auth/reset-password")
      .send({ token: "used-token-456", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already been used/i);
  });
});

// ─── Data Export Tests ──────────────────────────────────────────────

describe("GET /api/export", () => {
  it("should return all data types in export", async () => {
    const agent = await registerAndLogin("10.22.0.1", "export@example.com", "Export User", "Export Family");

    const res = await agent.get("/api/export");

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/myohana-export/);
    expect(res.body).toHaveProperty("exportDate");
    expect(res.body).toHaveProperty("family");
    expect(res.body).toHaveProperty("members");
    expect(res.body).toHaveProperty("messages");
    expect(res.body).toHaveProperty("vault");
    expect(res.body).toHaveProperty("calendar");
    expect(res.body).toHaveProperty("media");
    expect(res.body).toHaveProperty("photos");
    expect(res.body).toHaveProperty("pulses");
    expect(res.body).toHaveProperty("chat");
    expect(res.body).toHaveProperty("memories");
    expect(res.body).toHaveProperty("locations");
  });

  it("should reject unauthenticated requests", async () => {
    const agent = agentWithIp("10.22.0.2");
    const res = await agent.get("/api/export");
    expect(res.status).toBe(401);
  });
});

// ─── Account Deletion Tests ─────────────────────────────────────────

describe("DELETE /api/account", () => {
  it("should delete account successfully", async () => {
    const agent = await registerAndLogin("10.23.0.1", "delete@example.com", "Delete User", "Delete Family");
    const csrfRes = await agent.get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const res = await agent
      .delete("/api/account")
      .set("x-csrf-token", csrfToken)
      .send({ confirmEmail: "delete@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);

    // Verify user can no longer login
    const loginAgent = agentWithIp("10.23.0.2");
    const loginRes = await loginAgent
      .post("/api/auth/login")
      .send({ email: "delete@example.com", password: "password123" });
    expect(loginRes.status).toBe(401);
  });

  it("should reject mismatched confirm email", async () => {
    const agent = await registerAndLogin("10.23.1.1", "nodelete@example.com", "NoDelete User", "NoDelete Family");
    const csrfRes = await agent.get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const res = await agent
      .delete("/api/account")
      .set("x-csrf-token", csrfToken)
      .send({ confirmEmail: "wrong@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/confirm/i);
  });

  it("should cascade delete all family data when last admin", async () => {
    const agent = await registerAndLogin("10.23.2.1", "cascade@example.com", "Cascade User", "Cascade Family");

    // Add some family data via the API
    const csrfRes = await agent.get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    await agent
      .post("/api/messages")
      .set("x-csrf-token", csrfToken)
      .send({
        familyId: 0,  // Will be overridden by the route
        authorId: 0,
        title: "Test Message",
        content: "This should be deleted",
        type: "text",
      });

    // Delete the account
    const res = await agent
      .delete("/api/account")
      .set("x-csrf-token", csrfToken)
      .send({ confirmEmail: "cascade@example.com" });

    expect(res.status).toBe(200);

    // Verify family data is gone
    const db = new Database("data.db");
    const familyCount = db.prepare("SELECT COUNT(*) as c FROM families WHERE name = ?").get("Cascade Family") as any;
    expect(familyCount.c).toBe(0);
    db.close();
  });
});
