import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
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
  fileUrl: text("file_url"),
  fileKey: text("file_key"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
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
  source: text("source"),
  externalId: text("external_id"),
  filename: text("filename"),
  mimeType: text("mime_type"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  memberId: integer("member_id"),
  role: text("role").notNull().default("parent"), // admin, parent, child
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const inviteCodes = sqliteTable("invite_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  code: text("code").notNull().unique(),
  createdById: integer("created_by_id").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  memberId: integer("member_id").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  address: text("address"),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  senderName: text("sender_name").notNull(),
  platform: text("platform").notNull().default("internal"), // imessage, whatsapp, sms, internal
  content: text("content").notNull(),
  externalId: text("external_id"),
  importedAt: text("imported_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const memoryAtoms = sqliteTable("memory_atoms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  sourceType: text("source_type").notNull(), // photo, message, event, pulse, milestone, chat
  sourceId: integer("source_id"),
  title: text("title").notNull(),
  description: text("description"),
  memberIds: text("member_ids"), // JSON array of member IDs involved
  createdById: integer("created_by_id"),
  category: text("category").notNull().default("daily_life"), // daily_life, milestone, celebration, family_time, school, travel, holiday, tender_moment, funny, creative
  emotionalTone: text("emotional_tone").notNull().default("joyful"), // joyful, tender, proud, playful, bittersweet, grateful, peaceful, excited
  occurredAt: text("occurred_at").notNull(),
  metadata: text("metadata"), // JSON — flexible storage for source-specific data
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const memoryCompilations = sqliteTable("memory_compilations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  type: text("type").notNull(), // weekly, monthly, yearly, custom, on_this_day, legacy
  title: text("title").notNull(),
  narrative: text("narrative"), // AI-generated warm narrative text
  coverAtomId: integer("cover_atom_id"),
  atomIds: text("atom_ids"), // JSON array of memory atom IDs in order
  perspectiveMemberId: integer("perspective_member_id"), // nullable — for Personal Lens
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  generatedAt: text("generated_at").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  status: text("status").notNull().default("active"), // active, cancelled, past_due, trialing
  plan: text("plan").notNull().default("family"), // family, extended
  priceMonthly: integer("price_monthly").notNull().default(1999), // cents
  startedAt: text("started_at").notNull(),
  expiresAt: text("expires_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const llmConversations = sqliteTable("llm_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull(),
  userId: integer("user_id").notNull(),
  title: text("title"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export const llmMessages = sqliteTable("llm_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(), // user, assistant
  content: text("content").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  model: text("model"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const googleOauthTokens = sqliteTable("google_oauth_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),
  familyId: integer("family_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: text("expires_at").notNull(),
  scope: text("scope").notNull(),
  tokenType: text("token_type").notNull().default("Bearer"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({ id: true, createdAt: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertMemoryAtomSchema = createInsertSchema(memoryAtoms).omit({ id: true, createdAt: true });
export const insertMemoryCompilationSchema = createInsertSchema(memoryCompilations).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true });
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export const insertLLMConversationSchema = createInsertSchema(llmConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLLMMessageSchema = createInsertSchema(llmMessages).omit({ id: true, createdAt: true });
export const insertGoogleOauthTokenSchema = createInsertSchema(googleOauthTokens).omit({ id: true, createdAt: true, updatedAt: true });

// Insert types
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertVaultDocument = z.infer<typeof insertVaultDocumentSchema>;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;
export type InsertThinkingOfYou = z.infer<typeof insertThinkingOfYouSchema>;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertInviteCode = z.infer<typeof insertInviteCodeSchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertMemoryAtom = z.infer<typeof insertMemoryAtomSchema>;
export type InsertMemoryCompilation = z.infer<typeof insertMemoryCompilationSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type InsertLLMConversation = z.infer<typeof insertLLMConversationSchema>;
export type InsertLLMMessage = z.infer<typeof insertLLMMessageSchema>;
export type InsertGoogleOauthToken = z.infer<typeof insertGoogleOauthTokenSchema>;

// Select types
export type Family = typeof families.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type VaultDocument = typeof vaultDocuments.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type MediaItem = typeof mediaItems.$inferSelect;
export type ThinkingOfYouPulse = typeof thinkingOfYou.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type User = typeof users.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type MemoryAtom = typeof memoryAtoms.$inferSelect;
export type MemoryCompilation = typeof memoryCompilations.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type LLMConversation = typeof llmConversations.$inferSelect;
export type LLMMessage = typeof llmMessages.$inferSelect;
export type GoogleOauthToken = typeof googleOauthTokens.$inferSelect;
