import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import {
  insertMessageSchema,
  insertVaultDocumentSchema,
  insertCalendarEventSchema,
  insertMediaItemSchema,
  insertThinkingOfYouSchema,
  insertPhotoSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed database on start
  await seedDatabase();

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

  return httpServer;
}
