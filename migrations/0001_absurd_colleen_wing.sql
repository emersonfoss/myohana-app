CREATE TABLE `password_reset_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT '2026-03-27T23:00:36.041Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_unique` ON `password_reset_tokens` (`token`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`location` text,
	`member_ids` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT '2026-03-27T23:00:36.040Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_calendar_events`("id", "family_id", "title", "description", "start_date", "end_date", "location", "member_ids", "source", "created_at") SELECT "id", "family_id", "title", "description", "start_date", "end_date", "location", "member_ids", "source", "created_at" FROM `calendar_events`;--> statement-breakpoint
DROP TABLE `calendar_events`;--> statement-breakpoint
ALTER TABLE `__new_calendar_events` RENAME TO `calendar_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`sender_name` text NOT NULL,
	`platform` text DEFAULT 'internal' NOT NULL,
	`content` text NOT NULL,
	`external_id` text,
	`imported_at` text,
	`created_at` text DEFAULT '2026-03-27T23:00:36.041Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_chat_messages`("id", "family_id", "sender_name", "platform", "content", "external_id", "imported_at", "created_at") SELECT "id", "family_id", "sender_name", "platform", "content", "external_id", "imported_at", "created_at" FROM `chat_messages`;--> statement-breakpoint
DROP TABLE `chat_messages`;--> statement-breakpoint
ALTER TABLE `__new_chat_messages` RENAME TO `chat_messages`;--> statement-breakpoint
CREATE TABLE `__new_families` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT '2026-03-27T23:00:36.039Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_families`("id", "name", "created_at") SELECT "id", "name", "created_at" FROM `families`;--> statement-breakpoint
DROP TABLE `families`;--> statement-breakpoint
ALTER TABLE `__new_families` RENAME TO `families`;--> statement-breakpoint
CREATE TABLE `__new_family_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`age` integer,
	`date_of_birth` text,
	`emoji` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT '2026-03-27T23:00:36.040Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_family_members`("id", "family_id", "name", "role", "age", "date_of_birth", "emoji", "description", "created_at") SELECT "id", "family_id", "name", "role", "age", "date_of_birth", "emoji", "description", "created_at" FROM `family_members`;--> statement-breakpoint
DROP TABLE `family_members`;--> statement-breakpoint
ALTER TABLE `__new_family_members` RENAME TO `family_members`;--> statement-breakpoint
CREATE TABLE `__new_invite_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`code` text NOT NULL,
	`created_by_id` integer NOT NULL,
	`created_at` text DEFAULT '2026-03-27T23:00:36.041Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_invite_codes`("id", "family_id", "code", "created_by_id", "created_at") SELECT "id", "family_id", "code", "created_by_id", "created_at" FROM `invite_codes`;--> statement-breakpoint
DROP TABLE `invite_codes`;--> statement-breakpoint
ALTER TABLE `__new_invite_codes` RENAME TO `invite_codes`;--> statement-breakpoint
CREATE UNIQUE INDEX `invite_codes_code_unique` ON `invite_codes` (`code`);--> statement-breakpoint
CREATE TABLE `__new_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`address` text,
	`updated_at` text DEFAULT '2026-03-27T23:00:36.041Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_locations`("id", "family_id", "member_id", "latitude", "longitude", "address", "updated_at") SELECT "id", "family_id", "member_id", "latitude", "longitude", "address", "updated_at" FROM `locations`;--> statement-breakpoint
DROP TABLE `locations`;--> statement-breakpoint
ALTER TABLE `__new_locations` RENAME TO `locations`;--> statement-breakpoint
CREATE TABLE `__new_media_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`added_by_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`approved_for_ages` text,
	`created_at` text DEFAULT '2026-03-27T23:00:36.040Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_media_items`("id", "family_id", "added_by_id", "title", "url", "type", "approved_for_ages", "created_at") SELECT "id", "family_id", "added_by_id", "title", "url", "type", "approved_for_ages", "created_at" FROM `media_items`;--> statement-breakpoint
DROP TABLE `media_items`;--> statement-breakpoint
ALTER TABLE `__new_media_items` RENAME TO `media_items`;--> statement-breakpoint
CREATE TABLE `__new_memory_atoms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_id` integer,
	`title` text NOT NULL,
	`description` text,
	`member_ids` text,
	`created_by_id` integer,
	`category` text DEFAULT 'daily_life' NOT NULL,
	`emotional_tone` text DEFAULT 'joyful' NOT NULL,
	`occurred_at` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT '2026-03-27T23:00:36.041Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_memory_atoms`("id", "family_id", "source_type", "source_id", "title", "description", "member_ids", "created_by_id", "category", "emotional_tone", "occurred_at", "metadata", "created_at") SELECT "id", "family_id", "source_type", "source_id", "title", "description", "member_ids", "created_by_id", "category", "emotional_tone", "occurred_at", "metadata", "created_at" FROM `memory_atoms`;--> statement-breakpoint
DROP TABLE `memory_atoms`;--> statement-breakpoint
ALTER TABLE `__new_memory_atoms` RENAME TO `memory_atoms`;--> statement-breakpoint
CREATE TABLE `__new_memory_compilations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`narrative` text,
	`cover_atom_id` integer,
	`atom_ids` text,
	`perspective_member_id` integer,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`generated_at` text NOT NULL,
	`created_at` text DEFAULT '2026-03-27T23:00:36.041Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_memory_compilations`("id", "family_id", "type", "title", "narrative", "cover_atom_id", "atom_ids", "perspective_member_id", "period_start", "period_end", "generated_at", "created_at") SELECT "id", "family_id", "type", "title", "narrative", "cover_atom_id", "atom_ids", "perspective_member_id", "period_start", "period_end", "generated_at", "created_at" FROM `memory_compilations`;--> statement-breakpoint
DROP TABLE `memory_compilations`;--> statement-breakpoint
ALTER TABLE `__new_memory_compilations` RENAME TO `memory_compilations`;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`recipient_id` integer,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`created_at` text DEFAULT '2026-03-27T23:00:36.040Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "family_id", "author_id", "recipient_id", "title", "content", "type", "created_at") SELECT "id", "family_id", "author_id", "recipient_id", "title", "content", "type", "created_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
CREATE TABLE `__new_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`uploaded_by_id` integer NOT NULL,
	`url` text NOT NULL,
	`caption` text,
	`taken_at` text,
	`created_at` text DEFAULT '2026-03-27T23:00:36.040Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_photos`("id", "family_id", "uploaded_by_id", "url", "caption", "taken_at", "created_at") SELECT "id", "family_id", "uploaded_by_id", "url", "caption", "taken_at", "created_at" FROM `photos`;--> statement-breakpoint
DROP TABLE `photos`;--> statement-breakpoint
ALTER TABLE `__new_photos` RENAME TO `photos`;--> statement-breakpoint
CREATE TABLE `__new_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`plan` text DEFAULT 'family' NOT NULL,
	`price_monthly` integer DEFAULT 1999 NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` text DEFAULT '2026-03-27T23:00:36.041Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_subscriptions`("id", "family_id", "status", "plan", "price_monthly", "started_at", "expires_at", "stripe_customer_id", "stripe_subscription_id", "created_at") SELECT "id", "family_id", "status", "plan", "price_monthly", "started_at", "expires_at", "stripe_customer_id", "stripe_subscription_id", "created_at" FROM `subscriptions`;--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_subscriptions` RENAME TO `subscriptions`;--> statement-breakpoint
CREATE TABLE `__new_thinking_of_you` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`sender_id` integer NOT NULL,
	`recipient_id` integer NOT NULL,
	`created_at` text DEFAULT '2026-03-27T23:00:36.040Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_thinking_of_you`("id", "family_id", "sender_id", "recipient_id", "created_at") SELECT "id", "family_id", "sender_id", "recipient_id", "created_at" FROM `thinking_of_you`;--> statement-breakpoint
DROP TABLE `thinking_of_you`;--> statement-breakpoint
ALTER TABLE `__new_thinking_of_you` RENAME TO `thinking_of_you`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`member_id` integer,
	`role` text DEFAULT 'parent' NOT NULL,
	`created_at` text DEFAULT '2026-03-27T23:00:36.040Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "family_id", "email", "password", "name", "member_id", "role", "created_at") SELECT "id", "family_id", "email", "password", "name", "member_id", "role", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `__new_vault_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`uploaded_by_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`expires_at` text,
	`created_at` text DEFAULT '2026-03-27T23:00:36.040Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_vault_documents`("id", "family_id", "uploaded_by_id", "name", "category", "description", "expires_at", "created_at") SELECT "id", "family_id", "uploaded_by_id", "name", "category", "description", "expires_at", "created_at" FROM `vault_documents`;--> statement-breakpoint
DROP TABLE `vault_documents`;--> statement-breakpoint
ALTER TABLE `__new_vault_documents` RENAME TO `vault_documents`;