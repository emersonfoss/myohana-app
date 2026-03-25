import {
  type Family, type InsertFamily, families,
  type FamilyMember, type InsertFamilyMember, familyMembers,
  type Message, type InsertMessage, messages,
  type VaultDocument, type InsertVaultDocument, vaultDocuments,
  type CalendarEvent, type InsertCalendarEvent, calendarEvents,
  type MediaItem, type InsertMediaItem, mediaItems,
  type ThinkingOfYouPulse, type InsertThinkingOfYou, thinkingOfYou,
  type Photo, type InsertPhoto, photos,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export interface IStorage {
  // Family
  getFamily(): Promise<Family | undefined>;
  getFamilyMembers(familyId: number): Promise<FamilyMember[]>;
  getFamilyMember(id: number): Promise<FamilyMember | undefined>;
  createFamily(family: InsertFamily): Promise<Family>;
  createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember>;

  // Messages
  getMessages(familyId: number, recipientId?: number): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Vault
  getVaultDocuments(familyId: number): Promise<VaultDocument[]>;
  createVaultDocument(doc: InsertVaultDocument): Promise<VaultDocument>;
  deleteVaultDocument(id: number): Promise<void>;

  // Calendar
  getCalendarEvents(familyId: number): Promise<CalendarEvent[]>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;

  // Media
  getMediaItems(familyId: number): Promise<MediaItem[]>;
  createMediaItem(item: InsertMediaItem): Promise<MediaItem>;
  deleteMediaItem(id: number): Promise<void>;

  // Thinking of You
  getThinkingOfYouPulses(familyId: number): Promise<ThinkingOfYouPulse[]>;
  createThinkingOfYouPulse(pulse: InsertThinkingOfYou): Promise<ThinkingOfYouPulse>;

  // Photos
  getPhotos(familyId: number): Promise<Photo[]>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;

  // Stats
  getStats(familyId: number): Promise<{
    messageCount: number;
    photoCount: number;
    eventCount: number;
    vaultCount: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Family
  async getFamily(): Promise<Family | undefined> {
    return db.select().from(families).get();
  }

  async getFamilyMembers(familyId: number): Promise<FamilyMember[]> {
    return db.select().from(familyMembers).where(eq(familyMembers.familyId, familyId)).all();
  }

  async getFamilyMember(id: number): Promise<FamilyMember | undefined> {
    return db.select().from(familyMembers).where(eq(familyMembers.id, id)).get();
  }

  async createFamily(family: InsertFamily): Promise<Family> {
    return db.insert(families).values(family).returning().get();
  }

  async createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember> {
    return db.insert(familyMembers).values(member).returning().get();
  }

  // Messages
  async getMessages(familyId: number, recipientId?: number): Promise<Message[]> {
    if (recipientId !== undefined) {
      return db.select().from(messages)
        .where(eq(messages.familyId, familyId))
        .orderBy(desc(messages.createdAt))
        .all()
        .filter(m => m.recipientId === recipientId || m.recipientId === null);
    }
    return db.select().from(messages)
      .where(eq(messages.familyId, familyId))
      .orderBy(desc(messages.createdAt))
      .all();
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return db.select().from(messages).where(eq(messages.id, id)).get();
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    return db.insert(messages).values(message).returning().get();
  }

  // Vault
  async getVaultDocuments(familyId: number): Promise<VaultDocument[]> {
    return db.select().from(vaultDocuments)
      .where(eq(vaultDocuments.familyId, familyId))
      .orderBy(desc(vaultDocuments.createdAt))
      .all();
  }

  async createVaultDocument(doc: InsertVaultDocument): Promise<VaultDocument> {
    return db.insert(vaultDocuments).values(doc).returning().get();
  }

  async deleteVaultDocument(id: number): Promise<void> {
    db.delete(vaultDocuments).where(eq(vaultDocuments.id, id)).run();
  }

  // Calendar
  async getCalendarEvents(familyId: number): Promise<CalendarEvent[]> {
    return db.select().from(calendarEvents)
      .where(eq(calendarEvents.familyId, familyId))
      .orderBy(calendarEvents.startDate)
      .all();
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    return db.insert(calendarEvents).values(event).returning().get();
  }

  // Media
  async getMediaItems(familyId: number): Promise<MediaItem[]> {
    return db.select().from(mediaItems)
      .where(eq(mediaItems.familyId, familyId))
      .orderBy(desc(mediaItems.createdAt))
      .all();
  }

  async createMediaItem(item: InsertMediaItem): Promise<MediaItem> {
    return db.insert(mediaItems).values(item).returning().get();
  }

  async deleteMediaItem(id: number): Promise<void> {
    db.delete(mediaItems).where(eq(mediaItems.id, id)).run();
  }

  // Thinking of You
  async getThinkingOfYouPulses(familyId: number): Promise<ThinkingOfYouPulse[]> {
    return db.select().from(thinkingOfYou)
      .where(eq(thinkingOfYou.familyId, familyId))
      .orderBy(desc(thinkingOfYou.createdAt))
      .all();
  }

  async createThinkingOfYouPulse(pulse: InsertThinkingOfYou): Promise<ThinkingOfYouPulse> {
    return db.insert(thinkingOfYou).values(pulse).returning().get();
  }

  // Photos
  async getPhotos(familyId: number): Promise<Photo[]> {
    return db.select().from(photos)
      .where(eq(photos.familyId, familyId))
      .orderBy(desc(photos.createdAt))
      .all();
  }

  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    return db.insert(photos).values(photo).returning().get();
  }

  // Stats
  async getStats(familyId: number): Promise<{
    messageCount: number;
    photoCount: number;
    eventCount: number;
    vaultCount: number;
  }> {
    const msgs = db.select().from(messages).where(eq(messages.familyId, familyId)).all();
    const pics = db.select().from(photos).where(eq(photos.familyId, familyId)).all();
    const events = db.select().from(calendarEvents).where(eq(calendarEvents.familyId, familyId)).all();
    const docs = db.select().from(vaultDocuments).where(eq(vaultDocuments.familyId, familyId)).all();
    return {
      messageCount: msgs.length,
      photoCount: pics.length,
      eventCount: events.length,
      vaultCount: docs.length,
    };
  }
}

export const storage = new DatabaseStorage();
