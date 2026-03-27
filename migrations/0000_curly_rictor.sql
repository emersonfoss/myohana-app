CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`location` text,
	`member_ids` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`sender_name` text NOT NULL,
	`platform` text DEFAULT 'internal' NOT NULL,
	`content` text NOT NULL,
	`external_id` text,
	`imported_at` text,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `families` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT '2026-03-27T22:35:34.549Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`age` integer,
	`date_of_birth` text,
	`emoji` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT '2026-03-27T22:35:34.549Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`code` text NOT NULL,
	`created_by_id` integer NOT NULL,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_codes_code_unique` ON `invite_codes` (`code`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`address` text,
	`updated_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`added_by_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`approved_for_ages` text,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_atoms` (
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
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_compilations` (
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
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`recipient_id` integer,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`uploaded_by_id` integer NOT NULL,
	`url` text NOT NULL,
	`caption` text,
	`taken_at` text,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`plan` text DEFAULT 'family' NOT NULL,
	`price_monthly` integer DEFAULT 1999 NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thinking_of_you` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`sender_id` integer NOT NULL,
	`recipient_id` integer NOT NULL,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`member_id` integer,
	`role` text DEFAULT 'parent' NOT NULL,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vault_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`uploaded_by_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`expires_at` text,
	`created_at` text DEFAULT '2026-03-27T22:35:34.550Z' NOT NULL
);
