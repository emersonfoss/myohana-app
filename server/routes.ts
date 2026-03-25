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
import createMemoryStore from "memorystore";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
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

const MemoryStore = createMemoryStore(session);

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed database on start
  await seedDatabase();

  // ─── Session + Passport Setup ──────────────────────────────────────
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "myohana-family-secret-key-2024",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86400000 }),
      cookie: { maxAge: 24 * 60 * 60 * 1000 },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

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

  // ─── Auth Routes ───────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
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

  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
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

  // ─── Auth Middleware ───────────────────────────────────────────────
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) return next();
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Apply requireAuth to all /api routes EXCEPT /api/auth/*
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/auth/") || req.path.startsWith("/auth")) return next();
    return requireAuth(req, res, next);
  });

  // ─── WebSocket Setup ───────────────────────────────────────────
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  function broadcast(data: Record<string, unknown>) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      } catch {
        // ignore malformed messages
      }
    });
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadsDir));

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
        });
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
      const { plan } = req.body;
      const validPlan = plan === "extended" ? "extended" : "family";
      const price = validPlan === "extended" ? 2999 : 1999;
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const existing = await storage.getSubscription(req.user!.familyId);
      if (existing && existing.status === "active") {
        return res.status(400).json({ message: "Already subscribed" });
      }

      const sub = await storage.createSubscription({
        familyId: req.user!.familyId,
        status: "active",
        plan: validPlan,
        priceMonthly: price,
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        stripeCustomerId: `mock_cus_${req.user!.familyId}`,
        stripeSubscriptionId: `mock_sub_${Date.now()}`,
      });
      res.status(201).json({ subscription: sub });
    } catch (error) {
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.post("/api/billing/cancel", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      const sub = await storage.getSubscription(req.user!.familyId);
      if (!sub) return res.status(404).json({ message: "No subscription found" });
      const updated = await storage.updateSubscriptionStatus(sub.id, "cancelled");
      res.json({ subscription: updated });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.get("/api/billing/portal", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json({ url: "#/settings" });
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
      broadcast({ type: "chat", senderName: msg.senderName, content: msg.content });
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
      broadcast({ type: "chat", senderName: msg.senderName, content: msg.content });
      res.status(201).json(msg);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Webhook processing failed" });
    }
  });

  return httpServer;
}
