ALTER TABLE `movements` ADD `competency_date` text;--> statement-breakpoint
ALTER TABLE `movements` ADD `payment_method` text DEFAULT 'pix' NOT NULL;