CREATE TABLE `checklist_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`position` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`credit_earned` int,
	`credit_required` int,
	CONSTRAINT `checklist_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category_id` int NOT NULL,
	`position` int NOT NULL,
	`group_name` varchar(255) NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` varchar(255) NOT NULL,
	`credit` varchar(8) NOT NULL,
	`grade` varchar(8) NOT NULL DEFAULT '',
	`note` varchar(255) NOT NULL DEFAULT '',
	CONSTRAINT `checklist_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campus` varchar(64) NOT NULL,
	`semester` varchar(64) NOT NULL,
	`day` varchar(16) NOT NULL,
	`room` varchar(32) NOT NULL,
	`room_capacity` int,
	`start_time` varchar(8) NOT NULL,
	`end_time` varchar(8) NOT NULL,
	`course_code` varchar(16) NOT NULL,
	`course_name` varchar(255) NOT NULL,
	`section` varchar(16),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `class_schedule_id` PRIMARY KEY(`id`),
	CONSTRAINT `class_schedule_slot_uq` UNIQUE(`semester`,`day`,`room`,`start_time`,`course_code`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name_th` varchar(255) NOT NULL,
	`name_en` varchar(255) NOT NULL,
	`student_id` varchar(32) NOT NULL,
	`photo` varchar(500) NOT NULL DEFAULT '',
	`gpa` varchar(8) NOT NULL DEFAULT '',
	`total_credits` varchar(8) NOT NULL DEFAULT '',
	`credits_earned` varchar(8) NOT NULL DEFAULT '',
	`credits_transferred` varchar(8) NOT NULL DEFAULT '',
	`info` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_username_uq` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `checklist_categories` ADD CONSTRAINT `checklist_categories_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checklist_courses` ADD CONSTRAINT `checklist_courses_category_id_checklist_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `checklist_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `checklist_categories_student_idx` ON `checklist_categories` (`student_id`);--> statement-breakpoint
CREATE INDEX `checklist_courses_category_idx` ON `checklist_courses` (`category_id`);