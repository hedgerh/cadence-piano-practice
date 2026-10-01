CREATE TABLE `daily_plans` (
	`day` text PRIMARY KEY NOT NULL,
	`generated_at` integer NOT NULL,
	`learn_track_id` text
);
--> statement-breakpoint
CREATE TABLE `day_log` (
	`day` text PRIMARY KEY NOT NULL,
	`blocks_completed` integer DEFAULT 0 NOT NULL,
	`sessions_completed` integer DEFAULT 0 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`first_completed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `level_progress` (
	`level_id` text PRIMARY KEY NOT NULL,
	`track_id` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`first_completed_at` integer,
	`last_completed_at` integer,
	`last_score` integer DEFAULT 0 NOT NULL,
	`best_score` integer DEFAULT 0 NOT NULL,
	`best_time_ms` integer,
	`mastered` integer DEFAULT false NOT NULL,
	`mastered_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `level_progress_track_idx` ON `level_progress` (`track_id`);--> statement-breakpoint
CREATE INDEX `level_progress_mastered_idx` ON `level_progress` (`mastered`);--> statement-breakpoint
CREATE TABLE `plan_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`slot` integer NOT NULL,
	`type` text NOT NULL,
	`track_id` text NOT NULL,
	`level_id` text NOT NULL,
	`title` text NOT NULL,
	`blurb` text NOT NULL,
	`estimate_min` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`session_id` text,
	`completed_at` integer,
	`lesson_first` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`day`) REFERENCES `daily_plans`(`day`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_blocks_day_slot_uq` ON `plan_blocks` (`day`,`slot`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`midi_device_id` text,
	`midi_device_name` text,
	`show_mark_played_always` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`level_id` text NOT NULL,
	`step_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`result` text NOT NULL,
	`hint_level` integer DEFAULT 0 NOT NULL,
	`tries` integer,
	`chosen` text,
	`played_back` integer DEFAULT false NOT NULL,
	`elapsed_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_steps_session_ordinal_uq` ON `session_steps` (`session_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` text NOT NULL,
	`level_id` text NOT NULL,
	`kind` text NOT NULL,
	`plan_block_id` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`duration_ms` integer,
	`steps_total` integer DEFAULT 0 NOT NULL,
	`steps_clean` integer DEFAULT 0 NOT NULL,
	`steps_hinted` integer DEFAULT 0 NOT NULL,
	`steps_skipped` integer DEFAULT 0 NOT NULL,
	`steps_marked` integer DEFAULT 0 NOT NULL,
	`steps_wrong` integer DEFAULT 0 NOT NULL,
	`correct` integer,
	`passed` integer,
	`xp_steps` integer DEFAULT 0 NOT NULL,
	`xp_level` integer DEFAULT 0 NOT NULL,
	`xp_playback` integer DEFAULT 0 NOT NULL,
	`question_order` text
);
--> statement-breakpoint
CREATE INDEX `sessions_started_at_idx` ON `sessions` (`started_at`);--> statement-breakpoint
CREATE INDEX `sessions_level_idx` ON `sessions` (`level_id`);--> statement-breakpoint
CREATE TABLE `step_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` text NOT NULL,
	`level_id` text NOT NULL,
	`step_id` text NOT NULL,
	`interval_index` integer DEFAULT -1 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`due_on` text,
	`last_result` text,
	`last_seen_at` integer NOT NULL,
	`times_seen` integer DEFAULT 0 NOT NULL,
	`times_clean` integer DEFAULT 0 NOT NULL,
	`times_hinted` integer DEFAULT 0 NOT NULL,
	`times_wrong` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `step_progress_level_step_uq` ON `step_progress` (`level_id`,`step_id`);--> statement-breakpoint
CREATE INDEX `step_progress_due_on_idx` ON `step_progress` (`due_on`);--> statement-breakpoint
CREATE INDEX `step_progress_level_idx` ON `step_progress` (`level_id`);--> statement-breakpoint
CREATE TABLE `track_settings` (
	`track_id` text PRIMARY KEY NOT NULL,
	`visibility` text DEFAULT 'all' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`enrolled_at` integer NOT NULL,
	`last_new_level_at` integer,
	`lesson_seen_at` integer
);
--> statement-breakpoint
CREATE TABLE `xp_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`session_id` text,
	`step_id` text,
	`day` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `xp_ledger_day_idx` ON `xp_ledger` (`day`);