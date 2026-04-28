CREATE TABLE `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`git_url` text,
	`container_name` text NOT NULL,
	`image_name` text NOT NULL,
	`internal_port` integer,
	`url` text,
	`error` text,
	`workspace_path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deployment_id` text NOT NULL,
	`seq` integer NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`ts` integer NOT NULL,
	FOREIGN KEY (`deployment_id`) REFERENCES `deployments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_logs_deployment_seq` ON `logs` (`deployment_id`,`seq`);