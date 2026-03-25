import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const families = sqliteTable("families", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const familyMembers = sqliteTable("family_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // dad, mom, child, baby
  age: integer("age"),
  dateOfBirth: text("date_of_birth"),
  emoji: text("emoji").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  authorId: integer("author_id").notNull(),
  recipientId: integer("recipient_id"), // nullable = family-wide
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"), // text, video, rose, thorn
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const vaultDocuments = sqliteTable("vault_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  uploadedById: integer("uploaded_by_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(), // legal, health, insurance, identity, financial
  description: text("description"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const calendarEvents = sqliteTable("calendar_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  location: text("location"),
  memberIds: text("member_ids"), // JSON text
  source: text("source").notNull().default("manual"), // manual, google, school
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const mediaItems = sqliteTable("media_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  addedById: integer("added_by_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(), // youtube, book, music
  approvedForAges: text("approved_for_ages"), // JSON text
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const thinkingOfYou = sqliteTable("thinking_of_you", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  senderId: integer("sender_id").notNull(),
  recipientId: integer("recipient_id").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  uploadedById: integer("uploaded_by_id").notNull(),
  url: text("url").notNull(),
  caption: text("caption"),
  takenAt: text("taken_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// Insert schemas
export const insertFamilySchema = createInsertSchema(families).omit({ id: true, createdAt: true });
export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertVaultDocumentSchema = createInsertSchema(vaultDocuments).omit({ id: true, createdAt: true });
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true });
export const insertMediaItemSchema = createInsertSchema(mediaItems).omit({ id: true, createdAt: true });
export const insertThinkingOfYouSchema = createInsertSchema(thinkingOfYou).omit({ id: true, createdAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, createdAt: true });

// Insert types
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertVaultDocument = z.infer<typeof insertVaultDocumentSchema>;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;
export type InsertThinkingOfYou = z.infer<typeof insertThinkingOfYouSchema>;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;

// Select types
export type Family = typeof families.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type VaultDocument = typeof vaultDocuments.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type MediaItem = typeof mediaItems.$inferSelect;
export type ThinkingOfYouPulse = typeof thinkingOfYou.$inferSelect;
export type Photo = typeof photos.$inferSelect;
