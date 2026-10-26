CREATE TABLE `allocation_usages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`allocation_id` text NOT NULL,
	`contribution_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`allocation_id`) REFERENCES `allocations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contribution_id`) REFERENCES `contributions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usage_allocation` ON `allocation_usages` (`allocation_id`);--> statement-breakpoint
CREATE INDEX `usage_contribution` ON `allocation_usages` (`contribution_id`);