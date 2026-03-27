import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import Database from "better-sqlite3";
import createSqliteStore from "better-sqlite3-session-store";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import rateLimit from "express-rate-limit";
import { WebSocketServer, WebSocket } from "ws";
import { storage, db } from "./storage";
import { seedDatabase } from "./seed";
import { memoryEngine } from "./memory-engine";
import { stripe, isStripeConfigured, STRIPE_PRICES, STRIPE_WEBHOOK_SECRET } from "./stripe";
import { sendEmail } from "./email";
import {
  insertMessageSchema,
  insertVaultDocumentSchema,
  insertCalendarEventSchema,
  insertMediaItemSchema,
  insertThinkingOfYouSchema,
  insertPhotoSchema,
  insertLocationSchema,
  insertChatMessageSchema,
  type User,
} from "@shared/schema";

const SqliteStore = createSqliteStore(session);
const sessionsDb = new Database("sessions.db");

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, s, 64).toString("hex");
  return { hash: `${s}:${hash}`, salt: s };
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const result = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === result;
}

declare global {
  namespace Express {
    interface User {
      id: number;
      familyId: number;
      email: string;
      name: string;
      memberId: number | null;
      role: string;
    }
  }
}

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
    }
  },
});

// ─── Session Secret ────────────────────────────────────────────────
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable is required in production"
    );
  }
  // Development: generate a random secret
  return crypto.randomBytes(32).toString("hex");
}

const sessionSecret = getSessionSecret();

// ─── Rate Limiters ─────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { message: "Too many registration attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { message: "Too many password reset requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── CSRF Protection ───────────────────────────────────────────────
const csrfExcludedPaths = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/join",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/chat/webhook",
  "/api/billing/webhook",
];

const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => sessionSecret,
  getSessionIdentifier: (req) => (req as any).session?.id ?? "",
  cookieName: process.env.NODE_ENV === "production" ? "__Host-psifi.x-csrf-token" : "x-csrf-token",
  cookieOptions: {
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
  getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"] as string,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed database on start
  await seedDatabase();

  // ─── Session + Passport Setup ──────────────────────────────────────
  const sessionMiddleware = session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new SqliteStore({
      client: sessionsDb,
      expired: {
        clear: true,
        intervalMs: 900000, // 15 minutes
      },
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(cookieParser());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) return done(null, false, { message: "Invalid email or password" });
          if (!verifyPassword(password, user.password)) return done(null, false, { message: "Invalid email or password" });
          return done(null, {
            id: user.id,
            familyId: user.familyId,
            email: user.email,
            name: user.name,
            memberId: user.memberId,
            role: user.role,
          });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) return done(null, false);
      done(null, {
        id: user.id,
        familyId: user.familyId,
        email: user.email,
        name: user.name,
        memberId: user.memberId,
        role: user.role,
      });
    } catch (err) {
      done(err);
    }
  });

  // ─── CSRF Token Endpoint ─────────────────────────────────────────
  app.get("/api/csrf-token", (req: Request, res: Response) => {
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  });

  // ─── Auth Routes ───────────────────────────────────────────────────
  app.post("/api/auth/register", registerLimiter, async (req: Request, res: Response) => {
    try {
      const { familyName, email, password, name } = req.body;
      if (!familyName || !email || !password || !name) {
        return res.status(400).json({ message: "All fields are required" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const family = await storage.createFamily({ name: familyName });
      const member = await storage.createFamilyMember({
        familyId: family.id,
        name,
        role: "parent",
        emoji: "👤",
      });
      const { hash } = hashPassword(password);
      const user = await storage.createUser({
        familyId: family.id,
        email,
        password: hash,
        name,
        memberId: member.id,
        role: "admin",
      });
      const sessionUser: Express.User = {
        id: user.id,
        familyId: user.familyId,
        email: user.email,
        name: user.name,
        memberId: user.memberId,
        role: user.role,
      };
      req.login(sessionUser, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        return res.status(201).json(sessionUser);
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", loginLimiter, (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });

  app.post("/api/auth/invite", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user!;
    if (user.role !== "admin" && user.role !== "parent") {
      return res.status(403).json({ message: "Only parents can create invites" });
    }
    const code = crypto.randomBytes(6).toString("hex");
    storage.createInviteCode({ familyId: user.familyId, code, createdById: user.id });
    res.json({ inviteCode: code });
  });

  app.post("/api/auth/join", async (req: Request, res: Response) => {
    try {
      const { inviteCode, email, password, name, role } = req.body;
      if (!inviteCode || !email || !password || !name) {
        return res.status(400).json({ message: "All fields are required" });
      }
      const invite = await storage.getInviteCode(inviteCode);
      if (!invite) return res.status(400).json({ message: "Invalid invite code" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "Email already registered" });
      const memberRole = role === "child" ? "child" : "parent";
      const member = await storage.createFamilyMember({
        familyId: invite.familyId,
        name,
        role: memberRole === "child" ? "child" : "mom",
        emoji: "👤",
      });
      const { hash } = hashPassword(password);
      const user = await storage.createUser({
        familyId: invite.familyId,
        email,
        password: hash,
        name,
        memberId: member.id,
        role: role || "parent",
      });
      const sessionUser: Express.User = {
        id: user.id,
        familyId: user.familyId,
        email: user.email,
        name: user.name,
        memberId: user.memberId,
        role: user.role,
      };
      req.login(sessionUser, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after joining" });
        return res.status(201).json(sessionUser);
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Join failed" });
    }
  });

  // ─── Forgot Password ─────────────────────────────────────────────
  app.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const user = await storage.getUserByEmail(email);
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
        await storage.createPasswordResetToken({ userId: user.id, token, expiresAt });

        const appUrl = process.env.APP_URL || "http://localhost:5000";
        const resetLink = `${appUrl}/#/reset-password?token=${token}`;
        await sendEmail({
          to: user.email,
          subject: "MyOhana — Password Reset",
          html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
        });
      }

      // Always return success to not reveal whether email exists
      res.json({ message: "If an account with that email exists, we've sent a reset link." });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Password reset request failed" });
    }
  });

  // ─── Reset Password ──────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ message: "Token and new password are required" });

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) return res.status(400).json({ message: "Invalid or expired reset token" });
      if (resetToken.usedAt) return res.status(400).json({ message: "This reset token has already been used" });
      if (new Date(resetToken.expiresAt) < new Date()) return res.status(400).json({ message: "This reset token has expired" });

      const { hash } = hashPassword(newPassword);
      await storage.updateUserPassword(resetToken.userId, hash);
      await storage.markPasswordResetTokenUsed(resetToken.id);

      res.json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Password reset failed" });
    }
  });

  // ─── Auth Middleware ───────────────────────────────────────────────
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) return next();
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Apply requireAuth to all /api routes EXCEPT /api/auth/*, /api/csrf-token, /api/billing/webhook, /api/config
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/auth/") || req.path.startsWith("/auth")) return next();
    if (req.path === "/csrf-token") return next();
    if (req.path === "/billing/webhook") return next();
    if (req.path === "/config") return next();
    return requireAuth(req, res, next);
  });

  // Apply CSRF protection to state-changing routes, excluding specific paths
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    // Skip GET, HEAD, OPTIONS
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    // Skip excluded paths
    const fullPath = `/api${req.path}`;
    if (csrfExcludedPaths.some((p) => fullPath === p)) return next();
    return doubleCsrfProtection(req, res, next);
  });

  // ─── Paywall Enforcement ────────────────────────────────────────
  // Routes exempt from paywall: auth, billing, config, family, stats, csrf-token
  const paywallExemptPaths = [
    "/auth",
    "/billing",
    "/config",
    "/family",
    "/stats",
    "/csrf-token",
    "/graph",
    "/export",
    "/account",
  ];

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    // Skip if Stripe is not configured — don't block access in dev
    if (!isStripeConfigured()) return next();

    // Skip exempt paths
    if (paywallExemptPaths.some((p) => req.path.startsWith(p) || req.path === p)) return next();

    // Skip if user is not authenticated (auth middleware handles that separately)
    if (!req.isAuthenticated()) return next();

    // Check subscription
    storage.getSubscription(req.user!.familyId).then((sub) => {
      if (sub && (sub.status === "active" || sub.status === "trialing")) {
        return next();
      }
      return res.status(403).json({
        error: "Subscription required",
        upgradeUrl: "/#/settings",
      });
    }).catch(() => next());
  });

  // ─── WebSocket Setup ───────────────────────────────────────────
  interface AuthenticatedWebSocket extends WebSocket {
    userId?: number;
    familyId?: number;
  }

  const wss = new WebSocketServer({ noServer: true });

  function broadcast(data: Record<string, unknown>, familyId?: number) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;
      if (authClient.readyState === WebSocket.OPEN) {
        if (familyId === undefined || authClient.familyId === familyId) {
          authClient.send(payload);
        }
      }
    });
  }

  // WebSocket authentication via session parsing
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }

    sessionMiddleware(req as any, {} as any, () => {
      const sess = (req as any).session;
      const passportUser = sess?.passport?.user;
      if (!passportUser) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        // Look up the full user to get familyId
        storage.getUserById(passportUser).then((user) => {
          if (user) {
            authWs.userId = user.id;
            authWs.familyId = user.familyId;
          }
          wss.emit("connection", ws, req);
        }).catch(() => {
          wss.emit("connection", ws, req);
        });
      });
    });
  });

  wss.on("connection", (ws: AuthenticatedWebSocket) => {
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        wss.clients.forEach((client) => {
          const authClient = client as AuthenticatedWebSocket;
          if (
            authClient !== ws &&
            authClient.readyState === WebSocket.OPEN &&
            authClient.familyId === ws.familyId
          ) {
            authClient.send(JSON.stringify(message));
          }
        });
      } catch {
        // ignore malformed messages
      }
    });
  });

  // Serve uploaded files — behind auth middleware
  app.use("/uploads", requireAuth, express.static(uploadsDir));

  // Get family + all members
  app.get("/api/family", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) {
        return res.status(404).json({ message: "No family found" });
      }
      const members = await storage.getFamilyMembers(family.id);
      res.json({ family, members });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch family" });
    }
  });

  // Get all messages
  app.get("/api/messages", async (req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const recipientId = req.query.recipientId ? Number(req.query.recipientId) : undefined;
      const msgs = await storage.getMessages(family.id, recipientId);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Create message
  app.post("/api/messages", async (req, res) => {
    try {
      const parsed = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(parsed);
      // Auto-ingest into memory
      const family = await storage.getFamily();
      if (family) {
        const members = await storage.getFamilyMembers(family.id);
        memoryEngine.ingestMessage(message, members).catch(() => {});
      }
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid message data" });
    }
  });

  // Get vault documents
  app.get("/api/vault", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const docs = await storage.getVaultDocuments(family.id);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vault documents" });
    }
  });

  // Add vault document
  app.post("/api/vault", async (req, res) => {
    try {
      const parsed = insertVaultDocumentSchema.parse(req.body);
      const doc = await storage.createVaultDocument(parsed);
      res.status(201).json(doc);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid document data" });
    }
  });

  // Delete vault document
  app.delete("/api/vault/:id", async (req, res) => {
    try {
      await storage.deleteVaultDocument(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Get calendar events
  app.get("/api/calendar", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const events = await storage.getCalendarEvents(family.id);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  // Create calendar event
  app.post("/api/calendar", async (req, res) => {
    try {
      const parsed = insertCalendarEventSchema.parse(req.body);
      const event = await storage.createCalendarEvent(parsed);
      // Auto-ingest into memory
      const family = await storage.getFamily();
      if (family) {
        const members = await storage.getFamilyMembers(family.id);
        memoryEngine.ingestEvent(event, members).catch(() => {});
      }
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid event data" });
    }
  });

  // Get media items
  app.get("/api/media", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const items = await storage.getMediaItems(family.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch media items" });
    }
  });

  // Add media item
  app.post("/api/media", async (req, res) => {
    try {
      const parsed = insertMediaItemSchema.parse(req.body);
      const item = await storage.createMediaItem(parsed);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid media data" });
    }
  });

  // Delete media item
  app.delete("/api/media/:id", async (req, res) => {
    try {
      await storage.deleteMediaItem(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete media item" });
    }
  });

  // Get thinking of you pulses
  app.get("/api/thinking-of-you", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const pulses = await storage.getThinkingOfYouPulses(family.id);
      res.json(pulses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pulses" });
    }
  });

  // Send thinking of you pulse
  app.post("/api/thinking-of-you", async (req, res) => {
    try {
      const parsed = insertThinkingOfYouSchema.parse(req.body);
      const pulse = await storage.createThinkingOfYouPulse(parsed);
      // Broadcast via WebSocket
      const family = await storage.getFamily();
      if (family) {
        const members = await storage.getFamilyMembers(family.id);
        const sender = members.find((m) => m.id === pulse.senderId);
        const recipient = members.find((m) => m.id === pulse.recipientId);
        broadcast({
          type: "pulse",
          senderName: sender?.name.split(" ")[0] || "Someone",
          recipientName: recipient?.name.split(" ")[0] || "Someone",
          senderEmoji: sender?.emoji || "💛",
        }, family.id);
        // Auto-ingest into memory
        memoryEngine.ingestPulse(pulse, members).catch(() => {});
      }
      res.status(201).json(pulse);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid pulse data" });
    }
  });

  // Get photos
  app.get("/api/photos", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const allPhotos = await storage.getPhotos(family.id);
      res.json(allPhotos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  // Upload photo metadata
  app.post("/api/photos", async (req, res) => {
    try {
      const parsed = insertPhotoSchema.parse(req.body);
      const photo = await storage.createPhoto(parsed);
      // Auto-ingest into memory
      const family = await storage.getFamily();
      if (family) {
        const members = await storage.getFamilyMembers(family.id);
        memoryEngine.ingestPhoto(photo, members).catch(() => {});
      }
      res.status(201).json(photo);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid photo data" });
    }
  });

  // Upload photo with file
  app.post("/api/photos/upload", upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      const parsed = insertPhotoSchema.parse({
        familyId: Number(req.body.familyId),
        uploadedById: Number(req.body.uploadedById),
        url: fileUrl,
        caption: req.body.caption || null,
        takenAt: req.body.takenAt || null,
      });
      const photo = await storage.createPhoto(parsed);
      // Auto-ingest into memory
      const family = await storage.getFamily();
      if (family) {
        const members = await storage.getFamilyMembers(family.id);
        memoryEngine.ingestPhoto(photo, members).catch(() => {});
      }
      res.status(201).json(photo);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to upload photo" });
    }
  });

  // Weekly memory compilation
  app.get("/api/memory/weekly", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });

      const members = await storage.getFamilyMembers(family.id);
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const allPhotos = await storage.getPhotos(family.id);
      const allMessages = await storage.getMessages(family.id);
      const allEvents = await storage.getCalendarEvents(family.id);
      const allPulses = await storage.getThinkingOfYouPulses(family.id);

      const weekPhotos = allPhotos.filter(
        (p) => new Date(p.createdAt) >= oneWeekAgo
      );
      const weekMessages = allMessages.filter(
        (m) => new Date(m.createdAt) >= oneWeekAgo
      );
      const weekEvents = allEvents.filter(
        (e) => new Date(e.startDate) >= oneWeekAgo && new Date(e.startDate) <= now
      );
      const weekPulses = allPulses.filter(
        (p) => new Date(p.createdAt) >= oneWeekAgo
      );

      // Build pulse summary per sender->recipient
      const pulseSummary: { sender: string; recipient: string; count: number; senderEmoji: string }[] = [];
      const pulseMap = new Map<string, number>();
      for (const pulse of weekPulses) {
        const key = `${pulse.senderId}-${pulse.recipientId}`;
        pulseMap.set(key, (pulseMap.get(key) || 0) + 1);
      }
      for (const [key, count] of pulseMap) {
        const [senderId, recipientId] = key.split("-").map(Number);
        const sender = members.find((m) => m.id === senderId);
        const recipient = members.find((m) => m.id === recipientId);
        if (sender && recipient) {
          pulseSummary.push({
            sender: sender.name.split(" ")[0],
            recipient: recipient.name.split(" ")[0],
            count,
            senderEmoji: sender.emoji,
          });
        }
      }

      // Generate warm highlights text
      const familyName = family.name.replace("The ", "").replace(" Family", "");
      const highlightParts: string[] = [];

      if (weekEvents.length > 0) {
        highlightParts.push(
          `${weekEvents.length} ${weekEvents.length === 1 ? "event" : "events"}`
        );
      }
      if (weekPhotos.length > 0) {
        highlightParts.push(
          `${weekPhotos.length} ${weekPhotos.length === 1 ? "photo" : "photos"}`
        );
      }
      if (weekMessages.length > 0) {
        highlightParts.push(
          `${weekMessages.length} ${weekMessages.length === 1 ? "message" : "messages"}`
        );
      }

      let highlights = "";
      if (highlightParts.length > 0) {
        highlights = `This week the ${familyName} family shared ${highlightParts.join(", ")}.`;
      } else {
        highlights = `A quiet week for the ${familyName} family — sometimes the sweetest moments are the simplest.`;
      }

      if (weekPulses.length > 0) {
        const topSender = pulseSummary.sort((a, b) => b.count - a.count)[0];
        if (topSender) {
          highlights += ` ${topSender.sender} sent ${topSender.count} thinking-of-you ${topSender.count === 1 ? "pulse" : "pulses"} to ${topSender.recipient}.`;
        }
      }

      // Format week range
      const weekStart = new Date(oneWeekAgo);
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const weekOf = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}-${now.getDate()}, ${now.getFullYear()}`;

      res.json({
        weekOf,
        photos: weekPhotos.map((p) => ({
          ...p,
          uploadedBy: members.find((m) => m.id === p.uploadedById)?.name || "Unknown",
        })),
        messages: weekMessages.map((m) => {
          const author = members.find((mem) => mem.id === m.authorId);
          const recipient = m.recipientId
            ? members.find((mem) => mem.id === m.recipientId)
            : null;
          return {
            ...m,
            authorName: author?.name.split(" ")[0] || "Unknown",
            authorEmoji: author?.emoji || "?",
            recipientName: recipient?.name.split(" ")[0] || "Everyone",
          };
        }),
        events: weekEvents.map((e) => ({
          ...e,
          memberNames: e.memberIds
            ? JSON.parse(e.memberIds)
                .map((id: number) => members.find((m) => m.id === id)?.name)
                .filter(Boolean)
            : [],
        })),
        pulses: pulseSummary,
        highlights,
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate weekly compilation" });
    }
  });

  // ─── Memory API Routes ─────────────────────────────────────────────

  // Timeline — paginated memory atoms
  app.get("/api/memories/timeline", async (req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = (page - 1) * limit;
      const memberId = req.query.memberId ? Number(req.query.memberId) : undefined;
      const memberIdsParam = req.query.memberIds as string | undefined;
      const memberIds = memberIdsParam ? memberIdsParam.split(",").map(Number) : undefined;
      const category = req.query.category as string | undefined;
      const atoms = await storage.getMemoryAtoms(family.id, {
        limit, offset, memberId, memberIds, category,
      });
      res.json(atoms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch timeline" });
    }
  });

  // Search memories
  app.get("/api/memories/search", async (req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const q = req.query.q as string;
      if (!q) return res.json([]);
      const results = await memoryEngine.searchMemories(family.id, q);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to search memories" });
    }
  });

  // On This Day
  app.get("/api/memories/on-this-day", async (req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const date = (req.query.date as string) || new Date().toISOString();
      const atoms = await memoryEngine.getOnThisDay(family.id, date);
      res.json(atoms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch on-this-day memories" });
    }
  });

  // Get all compilations
  app.get("/api/memories/compilations", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const compilations = await storage.getMemoryCompilations(family.id);
      res.json(compilations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch compilations" });
    }
  });

  // Get specific compilation with its atoms
  app.get("/api/memories/compilations/:id", async (req, res) => {
    try {
      const compilation = await storage.getMemoryCompilation(Number(req.params.id));
      if (!compilation) return res.status(404).json({ message: "Compilation not found" });
      const atomIds: number[] = compilation.atomIds ? JSON.parse(compilation.atomIds) : [];
      const atoms: any[] = [];
      for (const id of atomIds) {
        const atom = await storage.getMemoryAtom(id);
        if (atom) atoms.push(atom);
      }
      res.json({ ...compilation, atoms });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch compilation" });
    }
  });

  // Generate a new compilation
  app.post("/api/memories/compilations/generate", async (req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const { type, startDate, endDate, perspectiveMemberId } = req.body;
      if (!type || !startDate || !endDate) {
        return res.status(400).json({ message: "type, startDate, endDate required" });
      }
      let compilation;
      if (type === "weekly") {
        compilation = await memoryEngine.generateWeeklyCompilation(family.id, startDate, endDate);
      } else if (type === "monthly") {
        const d = new Date(startDate);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        compilation = await memoryEngine.generateMonthlyCompilation(family.id, monthNames[d.getMonth()], d.getFullYear());
      } else {
        // Custom compilation
        const atoms = await storage.getMemoryAtomsByDateRange(family.id, startDate, endDate);
        const members = await storage.getFamilyMembers(family.id);
        compilation = await storage.createMemoryCompilation({
          familyId: family.id,
          type: "custom",
          title: `${new Date(startDate).toLocaleDateString()} — ${new Date(endDate).toLocaleDateString()}`,
          narrative: memoryEngine.generateNarrative(atoms, family, members, "time period"),
          coverAtomId: atoms.find(a => a.sourceType === "photo")?.id || null,
          atomIds: JSON.stringify(atoms.map(a => a.id)),
          perspectiveMemberId: perspectiveMemberId || null,
          periodStart: startDate,
          periodEnd: endDate,
          generatedAt: new Date().toISOString(),
        });
      }
      res.status(201).json(compilation);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to generate compilation" });
    }
  });

  // Memory statistics
  app.get("/api/memories/stats", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const stats = await storage.getMemoryStats(family.id);
      // Also get the earliest memory for "growing since" info
      const atoms = await storage.getMemoryAtoms(family.id, { limit: 1 });
      const allAtoms = await storage.getMemoryAtoms(family.id, { limit: 10000 });
      const earliest = allAtoms.length > 0
        ? allAtoms.reduce((e, a) => a.occurredAt < e.occurredAt ? a : e)
        : null;
      res.json({
        ...stats,
        growingSince: earliest?.occurredAt || new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch memory stats" });
    }
  });

  // Ingest all existing content (one-time bootstrap)
  app.post("/api/memories/ingest-all", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const count = await memoryEngine.ingestAllExisting(family.id);
      res.json({ ingested: count });
    } catch (error) {
      res.status(500).json({ message: "Failed to ingest memories" });
    }
  });

  // Dashboard stats
  app.get("/api/stats", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const stats = await storage.getStats(family.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get all family member locations
  app.get("/api/locations", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const locs = await storage.getLocations(family.id);
      res.json(locs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  // Update a member's location
  app.post("/api/locations", async (req, res) => {
    try {
      const parsed = insertLocationSchema.parse(req.body);
      const location = await storage.updateLocation(parsed);
      res.status(201).json(location);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid location data" });
    }
  });

  // ─── Family Graph API ─────────────────────────────────────────────

  // Full family context for AI platforms
  app.get("/api/graph/context", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });

      const members = await storage.getFamilyMembers(family.id);
      const msgs = await storage.getMessages(family.id);
      const events = await storage.getCalendarEvents(family.id);
      const docs = await storage.getVaultDocuments(family.id);
      const media = await storage.getMediaItems(family.id);
      const pulses = await storage.getThinkingOfYouPulses(family.id);

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const membersContext = members.map((m) => {
        const memberMessages = msgs.filter((msg) => msg.authorId === m.id);
        const memberPulses = pulses.filter((p) => p.senderId === m.id);
        const lastMsg = memberMessages[0];
        const lastPulse = memberPulses[0];
        const lastActive = [lastMsg?.createdAt, lastPulse?.createdAt]
          .filter(Boolean)
          .sort()
          .reverse()[0];

        return {
          id: m.id,
          name: m.name,
          role: m.role,
          age: m.age,
          emoji: m.emoji,
          description: m.description,
          recentActivity: {
            messagesSent: memberMessages.length,
            pulsesSent: memberPulses.length,
            lastActive: lastActive || null,
          },
        };
      });

      const recentMessages = msgs.slice(0, 10).map((msg) => {
        const author = members.find((m) => m.id === msg.authorId);
        const recipient = msg.recipientId
          ? members.find((m) => m.id === msg.recipientId)
          : null;
        return {
          from: author?.name || "Unknown",
          to: recipient?.name || "Everyone",
          title: msg.title,
          type: msg.type,
          date: msg.createdAt,
        };
      });

      const upcomingEvents = events
        .filter((e) => new Date(e.startDate) >= now)
        .slice(0, 10)
        .map((e) => {
          const memberIds: number[] = e.memberIds
            ? JSON.parse(e.memberIds)
            : [];
          return {
            title: e.title,
            date: e.startDate,
            members: memberIds
              .map((id) => members.find((m) => m.id === id)?.name)
              .filter(Boolean),
          };
        });

      const expiringDocs = docs
        .filter(
          (d) =>
            d.expiresAt &&
            new Date(d.expiresAt) <= thirtyDaysFromNow &&
            new Date(d.expiresAt) >= now
        )
        .map((d) => d.name);

      const categories: Record<string, number> = {};
      for (const d of docs) {
        categories[d.category] = (categories[d.category] || 0) + 1;
      }

      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekPulses = pulses.filter(
        (p) => new Date(p.createdAt) >= oneWeekAgo
      );

      const senderCounts: Record<number, number> = {};
      for (const p of weekPulses) {
        senderCounts[p.senderId] = (senderCounts[p.senderId] || 0) + 1;
      }
      const mostConnectedId = Object.entries(senderCounts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];
      const mostConnected = mostConnectedId
        ? members.find((m) => m.id === Number(mostConnectedId))?.name || null
        : null;

      const activeSenderIds = new Set(weekPulses.map((p) => p.senderId));
      const activeAuthorIds = new Set(
        msgs
          .filter((m) => new Date(m.createdAt) >= oneWeekAgo)
          .map((m) => m.authorId)
      );
      const quietMembers = members
        .filter(
          (m) => !activeSenderIds.has(m.id) && !activeAuthorIds.has(m.id)
        )
        .map((m) => m.name);

      res.json({
        family: {
          name: family.name,
          memberCount: members.length,
          createdAt: family.createdAt,
        },
        members: membersContext,
        recentMessages,
        upcomingEvents,
        vaultSummary: {
          totalDocuments: docs.length,
          expiringWithin30Days: expiringDocs,
          categories,
        },
        mediaRoom: {
          totalApproved: media.length,
          recentlyAdded: media.slice(0, 5).map((m) => ({
            title: m.title,
            type: m.type,
          })),
        },
        emotionalPulse: {
          pulsesThisWeek: weekPulses.length,
          mostConnected,
          quietMembers,
        },
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to build family context" });
    }
  });

  // Detailed context for a specific member
  app.get("/api/graph/member/:id", async (req, res) => {
    try {
      const memberId = Number(req.params.id);
      const member = await storage.getFamilyMember(memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });

      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });

      const msgs = await storage.getMessages(family.id);
      const events = await storage.getCalendarEvents(family.id);
      const docs = await storage.getVaultDocuments(family.id);
      const pulses = await storage.getThinkingOfYouPulses(family.id);
      const allPhotos = await storage.getPhotos(family.id);

      const memberMessages = msgs.filter(
        (m) => m.authorId === memberId || m.recipientId === memberId
      );
      const memberEvents = events.filter((e) => {
        const ids: number[] = e.memberIds ? JSON.parse(e.memberIds) : [];
        return ids.includes(memberId);
      });
      const memberDocs = docs.filter((d) => d.uploadedById === memberId);
      const memberPulsesSent = pulses.filter((p) => p.senderId === memberId);
      const memberPulsesReceived = pulses.filter(
        (p) => p.recipientId === memberId
      );
      const memberPhotos = allPhotos.filter(
        (p) => p.uploadedById === memberId
      );

      res.json({
        member: {
          id: member.id,
          name: member.name,
          role: member.role,
          age: member.age,
          emoji: member.emoji,
          description: member.description,
        },
        messages: memberMessages.slice(0, 10).map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          date: m.createdAt,
        })),
        events: memberEvents.map((e) => ({
          title: e.title,
          date: e.startDate,
        })),
        vaultDocs: memberDocs.map((d) => ({
          name: d.name,
          category: d.category,
        })),
        pulses: {
          sent: memberPulsesSent.length,
          received: memberPulsesReceived.length,
        },
        photos: memberPhotos.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch member context" });
    }
  });

  // Natural language query endpoint
  app.get("/api/graph/query", async (req, res) => {
    try {
      const q = (req.query.q as string || "").toLowerCase();
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });

      const members = await storage.getFamilyMembers(family.id);

      if (/watch|movie|show|video/.test(q)) {
        const media = await storage.getMediaItems(family.id);
        return res.json({
          query: q,
          category: "media",
          results: {
            items: media.map((m) => ({
              title: m.title,
              type: m.type,
              url: m.url,
              approvedForAges: m.approvedForAges
                ? JSON.parse(m.approvedForAges)
                : [],
            })),
            memberAges: members.map((m) => ({
              name: m.name,
              age: m.age,
            })),
          },
        });
      }

      if (/calendar|schedule|event/.test(q)) {
        const events = await storage.getCalendarEvents(family.id);
        const now = new Date();
        return res.json({
          query: q,
          category: "calendar",
          results: events
            .filter((e) => new Date(e.startDate) >= now)
            .map((e) => {
              const ids: number[] = e.memberIds
                ? JSON.parse(e.memberIds)
                : [];
              return {
                title: e.title,
                date: e.startDate,
                location: e.location,
                members: ids
                  .map((id) => members.find((m) => m.id === id)?.name)
                  .filter(Boolean),
              };
            }),
        });
      }

      if (/birthday|birth/.test(q)) {
        return res.json({
          query: q,
          category: "birthdays",
          results: members.map((m) => ({
            name: m.name,
            age: m.age,
            dateOfBirth: m.dateOfBirth || null,
          })),
        });
      }

      if (/document|insurance|passport|vault/.test(q)) {
        const docs = await storage.getVaultDocuments(family.id);
        return res.json({
          query: q,
          category: "vault",
          results: docs.map((d) => ({
            name: d.name,
            category: d.category,
            description: d.description,
            expiresAt: d.expiresAt,
          })),
        });
      }

      if (/photo|memory|picture/.test(q)) {
        const photos = await storage.getPhotos(family.id);
        return res.json({
          query: q,
          category: "photos",
          results: photos.slice(0, 20).map((p) => ({
            url: p.url,
            caption: p.caption,
            takenAt: p.takenAt,
          })),
        });
      }

      // Default: redirect to full context
      return res.redirect("/api/graph/context");
    } catch (error) {
      res.status(500).json({ message: "Failed to process query" });
    }
  });

  // Schema description for AI platforms
  app.get("/api/graph/schema", async (_req, res) => {
    res.json({
      name: "myohana-family-graph",
      version: "1.0.0",
      entities: {
        family: {
          description:
            "The family unit. Currently single-family (The Foss Family).",
          fields: ["id", "name", "createdAt"],
        },
        familyMember: {
          description: "A member of the family with role, age, and personality.",
          fields: [
            "id",
            "familyId",
            "name",
            "role",
            "age",
            "dateOfBirth",
            "emoji",
            "description",
          ],
          roles: ["dad", "mom", "child", "baby"],
        },
        message: {
          description:
            "A message sent within the family. Can be family-wide or directed.",
          fields: [
            "id",
            "familyId",
            "authorId",
            "recipientId",
            "title",
            "content",
            "type",
            "createdAt",
          ],
          types: ["text", "video", "rose", "thorn"],
        },
        calendarEvent: {
          description: "A family event or appointment.",
          fields: [
            "id",
            "familyId",
            "title",
            "description",
            "startDate",
            "endDate",
            "location",
            "memberIds",
          ],
        },
        vaultDocument: {
          description:
            "An important family document stored securely.",
          fields: [
            "id",
            "familyId",
            "name",
            "category",
            "description",
            "expiresAt",
          ],
          categories: [
            "legal",
            "health",
            "insurance",
            "identity",
            "financial",
          ],
        },
        mediaItem: {
          description: "Approved media content for the family.",
          fields: [
            "id",
            "familyId",
            "title",
            "url",
            "type",
            "approvedForAges",
          ],
          types: ["youtube", "book", "music"],
        },
        thinkingOfYou: {
          description:
            "A pulse sent from one member to another — a small signal of love.",
          fields: [
            "id",
            "familyId",
            "senderId",
            "recipientId",
            "createdAt",
          ],
        },
        photo: {
          description: "A family photo or memory.",
          fields: [
            "id",
            "familyId",
            "url",
            "caption",
            "takenAt",
            "createdAt",
          ],
        },
      },
      relationships: [
        { from: "familyMember", to: "family", type: "belongs_to" },
        {
          from: "message",
          to: "familyMember",
          type: "authored_by / directed_to",
        },
        {
          from: "calendarEvent",
          to: "familyMember",
          type: "involves (many-to-many via JSON)",
        },
        { from: "vaultDocument", to: "familyMember", type: "uploaded_by" },
        { from: "mediaItem", to: "familyMember", type: "added_by" },
        {
          from: "thinkingOfYou",
          to: "familyMember",
          type: "sender / recipient",
        },
        { from: "photo", to: "familyMember", type: "uploaded_by" },
      ],
      endpoints: [
        {
          path: "/api/graph/context",
          method: "GET",
          description: "Complete family context for AI consumption",
        },
        {
          path: "/api/graph/member/:id",
          method: "GET",
          description: "Detailed context for a specific family member",
        },
        {
          path: "/api/graph/query?q=...",
          method: "GET",
          description: "Natural language query endpoint",
        },
        {
          path: "/api/graph/schema",
          method: "GET",
          description: "This schema description",
        },
        {
          path: "/api/graph/mcp-manifest",
          method: "GET",
          description: "MCP-compatible tool manifest",
        },
      ],
    });
  });

  // MCP-compatible manifest
  app.get("/api/graph/mcp-manifest", async (_req, res) => {
    res.json({
      name: "myohana-family-graph",
      version: "1.0.0",
      description:
        "Family context layer for AI platforms. Query the Foss Family Graph for ages, preferences, schedules, memories, and emotional signals.",
      tools: [
        {
          name: "get_family_context",
          description:
            "Get the complete family context including members, recent activity, events, and emotional signals",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_member_context",
          description:
            "Get detailed context for a specific family member",
          inputSchema: {
            type: "object",
            properties: { memberId: { type: "number" } },
            required: ["memberId"],
          },
        },
        {
          name: "query_family",
          description:
            "Ask a natural language question about the family",
          inputSchema: {
            type: "object",
            properties: { question: { type: "string" } },
            required: ["question"],
          },
        },
      ],
    });
  });

  // ─── Config Endpoint ─────────────────────────────────────────────
  app.get("/api/config", (_req: Request, res: Response) => {
    res.json({
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      billingEnabled: isStripeConfigured(),
    });
  });

  // ─── Billing Routes ─────────────────────────────────────────────
  app.get("/api/billing", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      const sub = await storage.getSubscription(req.user!.familyId);
      if (!sub) return res.json({ subscription: null });
      res.json({ subscription: sub });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch billing" });
    }
  });

  app.post("/api/billing/subscribe", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeConfigured() || !stripe) {
        return res.status(503).json({ error: "Billing not configured" });
      }

      const { plan } = req.body;
      const validPlan = plan === "extended" ? "extended" : "family";
      const priceId = STRIPE_PRICES[validPlan];
      if (!priceId) {
        return res.status(503).json({ error: "Billing not configured — price ID missing" });
      }

      const existing = await storage.getSubscription(req.user!.familyId);
      if (existing && existing.status === "active") {
        return res.status(400).json({ message: "Already subscribed" });
      }

      const appUrl = process.env.APP_URL || "http://localhost:5000";
      const userEmail = req.user!.email;
      const familyId = req.user!.familyId;

      // Look up or create a Stripe Customer
      let customerId: string | undefined;
      if (existing?.stripeCustomerId) {
        customerId = existing.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { familyId: String(familyId) },
        });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/#/settings?billing=success`,
        cancel_url: `${appUrl}/#/settings?billing=cancelled`,
        metadata: { familyId: String(familyId) },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe subscribe error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/billing/cancel", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      const sub = await storage.getSubscription(req.user!.familyId);
      if (!sub) return res.status(404).json({ message: "No subscription found" });

      if (isStripeConfigured() && stripe && sub.stripeSubscriptionId) {
        // Cancel at period end so user keeps access until billing period ends
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        // The actual status change will come via webhook when the period ends
        res.json({ subscription: sub, message: "Subscription will cancel at end of billing period" });
      } else {
        // Stripe not configured — just update locally
        const updated = await storage.updateSubscriptionStatus(sub.id, "cancelled");
        res.json({ subscription: updated });
      }
    } catch (error: any) {
      console.error("Stripe cancel error:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.get("/api/billing/portal", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeConfigured() || !stripe) {
        return res.status(503).json({ error: "Billing not configured" });
      }

      const sub = await storage.getSubscription(req.user!.familyId);
      if (!sub?.stripeCustomerId) {
        return res.status(400).json({ message: "No billing customer found. Please subscribe first." });
      }

      const appUrl = process.env.APP_URL || "http://localhost:5000";
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${appUrl}/#/settings`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error("Stripe portal error:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  // ─── Stripe Webhook ─────────────────────────────────────────────
  // The raw body is captured by express.json's verify callback in server/index.ts
  // (req.rawBody). This is needed for Stripe signature verification.
  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    if (!isStripeConfigured() || !stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ error: "Billing webhook not configured" });
    }

    const sig = req.headers["stripe-signature"] as string;
    let event: import("stripe").Stripe.Event;

    try {
      const rawBody = (req as any).rawBody as Buffer;
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`Stripe webhook received: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as import("stripe").Stripe.Checkout.Session;
          const familyId = parseInt(session.metadata?.familyId || "0", 10);
          if (!familyId) {
            console.error("Webhook: checkout.session.completed missing familyId in metadata");
            break;
          }

          const stripeCustomerId = session.customer as string;
          const stripeSubscriptionId = session.subscription as string;

          // Determine plan from the price
          let plan = "family";
          let priceMonthly = 1999;
          if (stripeSubscriptionId) {
            const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            const priceId = stripeSub.items.data[0]?.price?.id;
            if (priceId === STRIPE_PRICES.extended) {
              plan = "extended";
              priceMonthly = 2999;
            }
          }

          const now = new Date();
          const expiresAt = new Date(now);
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          const existing = await storage.getSubscription(familyId);
          if (existing) {
            await storage.updateSubscription(existing.id, {
              status: "active",
              plan,
              priceMonthly,
              stripeCustomerId,
              stripeSubscriptionId,
              expiresAt: expiresAt.toISOString(),
            });
          } else {
            await storage.createSubscription({
              familyId,
              status: "active",
              plan,
              priceMonthly,
              startedAt: now.toISOString(),
              expiresAt: expiresAt.toISOString(),
              stripeCustomerId,
              stripeSubscriptionId,
            });
          }
          console.log(`Webhook: subscription created/updated for family ${familyId}`);
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as import("stripe").Stripe.Invoice;
          const customerId = invoice.customer as string;
          const sub = await storage.getSubscriptionByStripeCustomerId(customerId);
          if (sub) {
            const periodEnd = invoice.lines?.data?.[0]?.period?.end;
            const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined;
            await storage.updateSubscription(sub.id, {
              status: "active",
              ...(expiresAt ? { expiresAt } : {}),
            });
            console.log(`Webhook: invoice.paid — subscription ${sub.id} renewed`);
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as import("stripe").Stripe.Invoice;
          const customerId = invoice.customer as string;
          const sub = await storage.getSubscriptionByStripeCustomerId(customerId);
          if (sub) {
            await storage.updateSubscriptionStatus(sub.id, "past_due");
            console.log(`Webhook: invoice.payment_failed — subscription ${sub.id} marked past_due`);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const stripeSub = event.data.object as import("stripe").Stripe.Subscription;
          const customerId = stripeSub.customer as string;
          const sub = await storage.getSubscriptionByStripeCustomerId(customerId);
          if (sub) {
            await storage.updateSubscriptionStatus(sub.id, "cancelled");
            console.log(`Webhook: customer.subscription.deleted — subscription ${sub.id} cancelled`);
          }
          break;
        }

        case "customer.subscription.updated": {
          const stripeSub = event.data.object as import("stripe").Stripe.Subscription;
          const customerId = stripeSub.customer as string;
          const sub = await storage.getSubscriptionByStripeCustomerId(customerId);
          if (sub) {
            const status = stripeSub.status === "active" ? "active"
              : stripeSub.status === "past_due" ? "past_due"
              : stripeSub.status === "trialing" ? "trialing"
              : stripeSub.status === "canceled" ? "cancelled"
              : sub.status;

            const priceId = stripeSub.items.data[0]?.price?.id;
            let plan = sub.plan;
            let priceMonthly = sub.priceMonthly;
            if (priceId === STRIPE_PRICES.family) {
              plan = "family";
              priceMonthly = 1999;
            } else if (priceId === STRIPE_PRICES.extended) {
              plan = "extended";
              priceMonthly = 2999;
            }

            await storage.updateSubscription(sub.id, { status, plan, priceMonthly });
            console.log(`Webhook: customer.subscription.updated — subscription ${sub.id} updated`);
          }
          break;
        }

        default:
          console.log(`Webhook: unhandled event type ${event.type}`);
      }
    } catch (error: any) {
      console.error(`Webhook handler error for ${event.type}:`, error);
      // Return 200 to avoid Stripe retrying on our processing errors
    }

    res.json({ received: true });
  });

  // ─── Calendar Sync (Placeholder) ────────────────────────────────
  app.post("/api/calendar/sync", (_req, res) => {
    res.json({ status: "not_configured", message: "Google Calendar OAuth not yet configured" });
  });

  // ─── Chat Bridge Routes ────────────────────────────────────────
  app.get("/api/chat", async (_req, res) => {
    try {
      const family = await storage.getFamily();
      if (!family) return res.status(404).json({ message: "No family found" });
      const msgs = await storage.getChatMessages(family.id, 50);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const parsed = insertChatMessageSchema.parse(req.body);
      const msg = await storage.createChatMessage(parsed);
      // Broadcast via WebSocket
      broadcast({ type: "chat", senderName: msg.senderName, content: msg.content }, msg.familyId);
      res.status(201).json(msg);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid chat message" });
    }
  });

  app.post("/api/chat/webhook", async (req, res) => {
    try {
      const { familyId, senderName, platform, content, externalId } = req.body;
      if (!familyId || !senderName || !content) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const msg = await storage.createChatMessage({
        familyId,
        senderName,
        platform: platform || "whatsapp",
        content,
        externalId: externalId || null,
        importedAt: new Date().toISOString(),
      });
      broadcast({ type: "chat", senderName: msg.senderName, content: msg.content }, msg.familyId);
      res.status(201).json(msg);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Webhook processing failed" });
    }
  });

  // ─── Change Password ─────────────────────────────────────────────
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      const user = await storage.getUserById(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!verifyPassword(currentPassword, user.password)) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const { hash } = hashPassword(newPassword);
      await storage.updateUserPassword(user.id, hash);
      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Password change failed" });
    }
  });

  // ─── Data Export ────────────────────────────────────────────────
  app.get("/api/export", async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const familyId = user.familyId;

      const [family, members, msgs, vault, calendar, media, pics, pulses, chat, atoms, compilations, locs] = await Promise.all([
        storage.getFamilyById(familyId),
        storage.getFamilyMembers(familyId),
        storage.getMessages(familyId),
        storage.getVaultDocuments(familyId),
        storage.getCalendarEvents(familyId),
        storage.getMediaItems(familyId),
        storage.getPhotos(familyId),
        storage.getThinkingOfYouPulses(familyId),
        storage.getChatMessages(familyId, 10000),
        storage.getMemoryAtoms(familyId, { limit: 100000 }),
        storage.getMemoryCompilations(familyId),
        storage.getLocations(familyId),
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        family,
        members,
        messages: msgs,
        vault,
        calendar,
        media,
        photos: pics,
        pulses,
        chat,
        memories: { atoms, compilations },
        locations: locs,
      };

      const dateStr = new Date().toISOString().split("T")[0];
      res.setHeader("Content-Disposition", `attachment; filename="myohana-export-${dateStr}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json(exportData);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Export failed" });
    }
  });

  // ─── Delete Account ─────────────────────────────────────────────
  app.delete("/api/account", async (req: Request, res: Response) => {
    try {
      const { confirmEmail } = req.body;
      const user = req.user!;

      if (!confirmEmail || confirmEmail !== user.email) {
        return res.status(400).json({ message: "Please confirm with your email address" });
      }

      const familyId = user.familyId;

      // Check if user is the last admin
      const familyUsers = await storage.getUsersByFamily(familyId);
      const admins = familyUsers.filter((u) => u.role === "admin");
      const isLastAdmin = admins.length === 1 && admins[0].id === user.id;

      // If Stripe configured and family has active subscription, cancel it
      if (isStripeConfigured() && stripe) {
        const sub = await storage.getSubscription(familyId);
        if (sub && sub.stripeSubscriptionId && sub.status === "active") {
          try {
            await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
          } catch {
            // Stripe cancellation failed, continue with deletion
          }
        }
      }

      if (isLastAdmin) {
        // Cascade delete all family data
        await storage.deleteFamilyData(familyId);
      } else {
        // Just delete this user
        await storage.deleteUser(user.id);
      }

      // Destroy session
      req.logout((err) => {
        if (err) return res.status(500).json({ message: "Account deleted but session cleanup failed" });
        req.session.destroy((err) => {
          if (err) return res.status(500).json({ message: "Account deleted but session cleanup failed" });
          res.json({ message: "Account deleted successfully" });
        });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Account deletion failed" });
    }
  });

  return httpServer;
}
