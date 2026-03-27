import {
  type Family, type InsertFamily, families,
  type FamilyMember, type InsertFamilyMember, familyMembers,
  type Message, type InsertMessage, messages,
  type VaultDocument, type InsertVaultDocument, vaultDocuments,
  type CalendarEvent, type InsertCalendarEvent, calendarEvents,
  type MediaItem, type InsertMediaItem, mediaItems,
  type ThinkingOfYouPulse, type InsertThinkingOfYou, thinkingOfYou,
  type Photo, type InsertPhoto, photos,
  type User, type InsertUser, users,
  type InviteCode, type InsertInviteCode, inviteCodes,
  type Location, type InsertLocation, locations,
  type Subscription, type InsertSubscription, subscriptions,
  type ChatMessage, type InsertChatMessage, chatMessages,
  type MemoryAtom, type InsertMemoryAtom, memoryAtoms,
  type MemoryCompilation, type InsertMemoryCompilation, memoryCompilations,
  type PasswordResetToken, type InsertPasswordResetToken, passwordResetTokens,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Ensure auth tables exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    member_id INTEGER,
    role TEXT NOT NULL DEFAULT 'parent',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_by_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    sender_name TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'internal',
    content TEXT NOT NULL,
    external_id TEXT,
    imported_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS memory_atoms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

// Add file columns to vault_documents if they don't exist (Sprint 3 migration)
try { sqlite.exec(`ALTER TABLE vault_documents ADD COLUMN file_url TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE vault_documents ADD COLUMN file_key TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE vault_documents ADD COLUMN file_size INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE vault_documents ADD COLUMN mime_type TEXT`); } catch {}

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
  getVaultDocument(id: number): Promise<VaultDocument | undefined>;
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

  // Users
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Invite codes
  createInviteCode(invite: InsertInviteCode): Promise<InviteCode>;
  getInviteCode(code: string): Promise<InviteCode | undefined>;

  // Family by ID
  getFamilyById(id: number): Promise<Family | undefined>;

  // Locations
  updateLocation(data: InsertLocation): Promise<Location>;
  getLocations(familyId: number): Promise<Location[]>;
  getMemberLocation(memberId: number): Promise<Location | undefined>;

  // Chat messages
  getChatMessages(familyId: number, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;

  // Memory Atoms
  getMemoryAtoms(familyId: number, options?: {
    limit?: number; offset?: number;
    memberId?: number; memberIds?: number[];
    category?: string; sourceType?: string;
  }): Promise<MemoryAtom[]>;
  getMemoryAtom(id: number): Promise<MemoryAtom | undefined>;
  createMemoryAtom(atom: InsertMemoryAtom): Promise<MemoryAtom>;
  searchMemoryAtoms(familyId: number, query: string): Promise<MemoryAtom[]>;
  getMemoryAtomsByDateRange(familyId: number, start: string, end: string): Promise<MemoryAtom[]>;
  getMemoryAtomsBySourceType(familyId: number, sourceType: string, sourceId: number): Promise<MemoryAtom[]>;
  getMemoryStats(familyId: number): Promise<{
    totalAtoms: number; byCategory: Record<string, number>;
    byMember: Record<number, number>; bySourceType: Record<string, number>;
  }>;

  // Memory Compilations
  getMemoryCompilations(familyId: number): Promise<MemoryCompilation[]>;
  getMemoryCompilation(id: number): Promise<MemoryCompilation | undefined>;
  createMemoryCompilation(comp: InsertMemoryCompilation): Promise<MemoryCompilation>;

  // Subscriptions
  getSubscription(familyId: number): Promise<Subscription | undefined>;
  getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined>;
  createSubscription(sub: InsertSubscription): Promise<Subscription>;
  updateSubscriptionStatus(id: number, status: string): Promise<Subscription | undefined>;
  updateSubscription(id: number, fields: Partial<InsertSubscription & { status: string }>): Promise<Subscription | undefined>;

  // Password Reset Tokens
  createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;

  // User updates
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  getUsersByFamily(familyId: number): Promise<User[]>;
  deleteUser(userId: number): Promise<void>;

  // Cascade delete
  deleteFamilyData(familyId: number): Promise<void>;
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

  async getVaultDocument(id: number): Promise<VaultDocument | undefined> {
    return db.select().from(vaultDocuments).where(eq(vaultDocuments.id, id)).get();
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

  // Users
  async getUserByEmail(email: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  async getUserById(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async createUser(user: InsertUser): Promise<User> {
    return db.insert(users).values(user).returning().get();
  }

  // Invite codes
  async createInviteCode(invite: InsertInviteCode): Promise<InviteCode> {
    return db.insert(inviteCodes).values(invite).returning().get();
  }

  async getInviteCode(code: string): Promise<InviteCode | undefined> {
    return db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).get();
  }

  // Family by ID
  async getFamilyById(id: number): Promise<Family | undefined> {
    return db.select().from(families).where(eq(families.id, id)).get();
  }

  // Locations
  async updateLocation(data: InsertLocation): Promise<Location> {
    const existing = db.select().from(locations).where(eq(locations.memberId, data.memberId)).get();
    if (existing) {
      db.update(locations)
        .set({ latitude: data.latitude, longitude: data.longitude, address: data.address, updatedAt: new Date().toISOString() })
        .where(eq(locations.memberId, data.memberId))
        .run();
      return db.select().from(locations).where(eq(locations.memberId, data.memberId)).get()!;
    }
    return db.insert(locations).values({ ...data, updatedAt: new Date().toISOString() }).returning().get();
  }

  async getLocations(familyId: number): Promise<Location[]> {
    return db.select().from(locations).where(eq(locations.familyId, familyId)).all();
  }

  async getMemberLocation(memberId: number): Promise<Location | undefined> {
    return db.select().from(locations).where(eq(locations.memberId, memberId)).get();
  }

  // Chat messages
  async getChatMessages(familyId: number, limit = 50): Promise<ChatMessage[]> {
    return db.select().from(chatMessages)
      .where(eq(chatMessages.familyId, familyId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .all()
      .reverse();
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    return db.insert(chatMessages).values(msg).returning().get();
  }

  // Memory Atoms
  async getMemoryAtoms(familyId: number, options?: {
    limit?: number; offset?: number;
    memberId?: number; memberIds?: number[];
    category?: string; sourceType?: string;
  }): Promise<MemoryAtom[]> {
    let results = db.select().from(memoryAtoms)
      .where(eq(memoryAtoms.familyId, familyId))
      .orderBy(desc(memoryAtoms.occurredAt))
      .all();

    if (options?.memberId) {
      const mid = options.memberId;
      results = results.filter(a => {
        if (!a.memberIds) return false;
        const ids: number[] = JSON.parse(a.memberIds);
        return ids.includes(mid);
      });
    }
    if (options?.memberIds && options.memberIds.length > 0) {
      const mids = options.memberIds;
      results = results.filter(a => {
        if (!a.memberIds) return false;
        const ids: number[] = JSON.parse(a.memberIds);
        return mids.every(mid => ids.includes(mid));
      });
    }
    if (options?.category) {
      results = results.filter(a => a.category === options.category);
    }
    if (options?.sourceType) {
      results = results.filter(a => a.sourceType === options.sourceType);
    }
    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    return results.slice(offset, offset + limit);
  }

  async getMemoryAtom(id: number): Promise<MemoryAtom | undefined> {
    return db.select().from(memoryAtoms).where(eq(memoryAtoms.id, id)).get();
  }

  async createMemoryAtom(atom: InsertMemoryAtom): Promise<MemoryAtom> {
    return db.insert(memoryAtoms).values(atom).returning().get();
  }

  async searchMemoryAtoms(familyId: number, query: string): Promise<MemoryAtom[]> {
    const all = db.select().from(memoryAtoms)
      .where(eq(memoryAtoms.familyId, familyId))
      .orderBy(desc(memoryAtoms.occurredAt))
      .all();
    const q = query.toLowerCase();
    return all.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.description && a.description.toLowerCase().includes(q)) ||
      (a.metadata && a.metadata.toLowerCase().includes(q))
    );
  }

  async getMemoryAtomsByDateRange(familyId: number, start: string, end: string): Promise<MemoryAtom[]> {
    return db.select().from(memoryAtoms)
      .where(eq(memoryAtoms.familyId, familyId))
      .orderBy(desc(memoryAtoms.occurredAt))
      .all()
      .filter(a => a.occurredAt >= start && a.occurredAt <= end);
  }

  async getMemoryAtomsBySourceType(familyId: number, sourceType: string, sourceId: number): Promise<MemoryAtom[]> {
    return db.select().from(memoryAtoms)
      .where(eq(memoryAtoms.familyId, familyId))
      .all()
      .filter(a => a.sourceType === sourceType && a.sourceId === sourceId);
  }

  async getMemoryStats(familyId: number): Promise<{
    totalAtoms: number; byCategory: Record<string, number>;
    byMember: Record<number, number>; bySourceType: Record<string, number>;
  }> {
    const all = db.select().from(memoryAtoms)
      .where(eq(memoryAtoms.familyId, familyId)).all();
    const byCategory: Record<string, number> = {};
    const byMember: Record<number, number> = {};
    const bySourceType: Record<string, number> = {};
    for (const a of all) {
      byCategory[a.category] = (byCategory[a.category] || 0) + 1;
      bySourceType[a.sourceType] = (bySourceType[a.sourceType] || 0) + 1;
      if (a.memberIds) {
        const ids: number[] = JSON.parse(a.memberIds);
        for (const id of ids) {
          byMember[id] = (byMember[id] || 0) + 1;
        }
      }
    }
    return { totalAtoms: all.length, byCategory, byMember, bySourceType };
  }

  // Memory Compilations
  async getMemoryCompilations(familyId: number): Promise<MemoryCompilation[]> {
    return db.select().from(memoryCompilations)
      .where(eq(memoryCompilations.familyId, familyId))
      .orderBy(desc(memoryCompilations.generatedAt))
      .all();
  }

  async getMemoryCompilation(id: number): Promise<MemoryCompilation | undefined> {
    return db.select().from(memoryCompilations).where(eq(memoryCompilations.id, id)).get();
  }

  async createMemoryCompilation(comp: InsertMemoryCompilation): Promise<MemoryCompilation> {
    return db.insert(memoryCompilations).values(comp).returning().get();
  }

  // Subscriptions
  async getSubscription(familyId: number): Promise<Subscription | undefined> {
    return db.select().from(subscriptions).where(eq(subscriptions.familyId, familyId)).get();
  }

  async createSubscription(sub: InsertSubscription): Promise<Subscription> {
    return db.insert(subscriptions).values(sub).returning().get();
  }

  async updateSubscriptionStatus(id: number, status: string): Promise<Subscription | undefined> {
    db.update(subscriptions).set({ status }).where(eq(subscriptions.id, id)).run();
    return db.select().from(subscriptions).where(eq(subscriptions.id, id)).get();
  }

  async getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined> {
    return db.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, stripeCustomerId)).get();
  }

  async updateSubscription(id: number, fields: Partial<InsertSubscription & { status: string }>): Promise<Subscription | undefined> {
    db.update(subscriptions).set(fields).where(eq(subscriptions.id, id)).run();
    return db.select().from(subscriptions).where(eq(subscriptions.id, id)).get();
  }

  // Password Reset Tokens
  async createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken> {
    return db.insert(passwordResetTokens).values(data).returning().get();
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).get();
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    db.update(passwordResetTokens).set({ usedAt: new Date().toISOString() }).where(eq(passwordResetTokens.id, id)).run();
  }

  // User updates
  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId)).run();
  }

  async getUsersByFamily(familyId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.familyId, familyId)).all();
  }

  async deleteUser(userId: number): Promise<void> {
    db.delete(users).where(eq(users.id, userId)).run();
  }

  // Cascade delete all family data
  async deleteFamilyData(familyId: number): Promise<void> {
    db.delete(messages).where(eq(messages.familyId, familyId)).run();
    db.delete(vaultDocuments).where(eq(vaultDocuments.familyId, familyId)).run();
    db.delete(calendarEvents).where(eq(calendarEvents.familyId, familyId)).run();
    db.delete(mediaItems).where(eq(mediaItems.familyId, familyId)).run();
    db.delete(thinkingOfYou).where(eq(thinkingOfYou.familyId, familyId)).run();
    db.delete(photos).where(eq(photos.familyId, familyId)).run();
    db.delete(locations).where(eq(locations.familyId, familyId)).run();
    db.delete(chatMessages).where(eq(chatMessages.familyId, familyId)).run();
    db.delete(memoryAtoms).where(eq(memoryAtoms.familyId, familyId)).run();
    db.delete(memoryCompilations).where(eq(memoryCompilations.familyId, familyId)).run();
    db.delete(subscriptions).where(eq(subscriptions.familyId, familyId)).run();
    db.delete(inviteCodes).where(eq(inviteCodes.familyId, familyId)).run();
    db.delete(users).where(eq(users.familyId, familyId)).run();
    db.delete(familyMembers).where(eq(familyMembers.familyId, familyId)).run();
    db.delete(families).where(eq(families.id, familyId)).run();
  }
}

export const storage = new DatabaseStorage();
