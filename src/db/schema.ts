import {
  mysqlTable,
  int,
  varchar,
  json,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

/** A label/value row shown on the student card, e.g. "คณะ" → "เทคโนโลยีสารสนเทศ". */
export interface InfoItemRow {
  label: string;
  value: string;
}

// Demo student accounts. All data lives locally — nothing is fetched from any
// university system. Passwords are scrypt hashes (see src/lib/passwords.ts).
export const students = mysqlTable(
  "students",
  {
    id: int("id").primaryKey().autoincrement(),

    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    nameTh: varchar("name_th", { length: 255 }).notNull(), // "นายสมชาย ใจดี"
    nameEn: varchar("name_en", { length: 255 }).notNull(), // "MR. SOMCHAI JAIDEE"
    studentId: varchar("student_id", { length: 32 }).notNull(), // "1650705566"
    photo: varchar("photo", { length: 500 }).notNull().default(""), // avatar URL/path

    gpa: varchar("gpa", { length: 8 }).notNull().default(""), // "3.42"
    totalCredits: varchar("total_credits", { length: 8 }).notNull().default(""), // required to graduate
    creditsEarned: varchar("credits_earned", { length: 8 }).notNull().default(""),
    creditsTransferred: varchar("credits_transferred", { length: 8 }).notNull().default(""),

    info: json("info").$type<InfoItemRow[]>().notNull(), // extra card rows (faculty, program, …)

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("students_username_uq").on(t.username)]
);

// A top-level checklist category, e.g. "หมวดวิชาศึกษาทั่วไป (Credit earned:30/30)".
export const checklistCategories = mysqlTable(
  "checklist_categories",
  {
    id: int("id").primaryKey().autoincrement(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    position: int("position").notNull(), // display order within the checklist
    name: varchar("name", { length: 255 }).notNull(),
    creditEarned: int("credit_earned"), // null when the category states no target
    creditRequired: int("credit_required"),
  },
  (t) => [index("checklist_categories_student_idx").on(t.studentId)]
);

// One course row of the checklist, grouped under a sub-group of its category
// (e.g. "เอกบังคับ - กลุ่มวิชาโครงสร้างพื้นฐาน (12 หน่วยกิต)"). A groupName of
// "-" means the course sits directly under the category with no sub-group.
export const checklistCourses = mysqlTable(
  "checklist_courses",
  {
    id: int("id").primaryKey().autoincrement(),
    categoryId: int("category_id")
      .notNull()
      .references(() => checklistCategories.id, { onDelete: "cascade" }),
    position: int("position").notNull(), // display order within the category
    groupName: varchar("group_name", { length: 255 }).notNull(),
    code: varchar("code", { length: 16 }).notNull(), // "CS301"
    name: varchar("name", { length: 255 }).notNull(),
    credit: varchar("credit", { length: 8 }).notNull(), // "3"
    grade: varchar("grade", { length: 8 }).notNull().default(""), // "", "A", "F", "W", …
    note: varchar("note", { length: 255 }).notNull().default(""), // prerequisites etc.
  },
  (t) => [index("checklist_courses_category_idx").on(t.categoryId)]
);

// One occupied slot in the room schedule grid, e.g. the cell
//   title="Software Engineering"  →  9.00-10.30 / CS302 / 421A
// sitting in room B205 (capacity 40) on Monday of "First Semester 2026".
export const classSchedule = mysqlTable(
  "class_schedule",
  {
    id: int("id").primaryKey().autoincrement(),

    campus: varchar("campus", { length: 64 }).notNull(), // "Main Campus"
    semester: varchar("semester", { length: 64 }).notNull(), // "First Semester 2026"
    day: varchar("day", { length: 16 }).notNull(), // "Monday"

    room: varchar("room", { length: 32 }).notNull(), // "B205"
    roomCapacity: int("room_capacity"), // 40 (null when unknown)

    startTime: varchar("start_time", { length: 8 }).notNull(), // "9.00"
    endTime: varchar("end_time", { length: 8 }).notNull(), // "10.30"

    courseCode: varchar("course_code", { length: 16 }).notNull(), // "CS302"
    courseName: varchar("course_name", { length: 255 }).notNull(), // "Software Engineering"
    section: varchar("section", { length: 16 }), // "421A" (null when the cell has none)

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // A room can only host one course at a given start time on a given day of a term.
    uniqueIndex("class_schedule_slot_uq").on(
      t.semester,
      t.day,
      t.room,
      t.startTime,
      t.courseCode
    ),
  ]
);

// A student's saved plan (the "Plan 1" header of the plan screen). One per
// student; the schedules below hang off it.
export const plans = mysqlTable(
  "plans",
  {
    id: int("id").primaryKey().autoincrement(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull().default("Plan 1"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("plans_student_uq").on(t.studentId)]
);

// One saved timetable candidate inside a plan ("SCHEDULE 1", "SCHEDULE 2", …).
// sectionKeys holds PlanSection keys (`${courseCode}·${section}`) resolved
// against class_schedule at render time, mirroring the localStorage builder.
export const planSchedules = mysqlTable(
  "plan_schedules",
  {
    id: int("id").primaryKey().autoincrement(),
    planId: int("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    position: int("position").notNull(), // display order within the plan
    title: varchar("title", { length: 100 }).notNull().default(""), // "" falls back to "Schedule N"
    liked: boolean("liked").notNull().default(false), // the ♥ button
    sectionKeys: json("section_keys").$type<string[]>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("plan_schedules_plan_idx").on(t.planId)]
);

// The schedule a student actually registered (REGISTER button). One per
// student per semester; re-registering replaces the section snapshot.
export const registrations = mysqlTable(
  "registrations",
  {
    id: int("id").primaryKey().autoincrement(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    semester: varchar("semester", { length: 64 }).notNull(),
    sectionKeys: json("section_keys").$type<string[]>().notNull(),
    registeredAt: timestamp("registered_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("registrations_student_semester_uq").on(t.studentId, t.semester)]
);

export type StudentRow = typeof students.$inferSelect;
export type ClassScheduleRow = typeof classSchedule.$inferSelect;
export type NewClassScheduleRow = typeof classSchedule.$inferInsert;
export type PlanRow = typeof plans.$inferSelect;
export type PlanScheduleRow = typeof planSchedules.$inferSelect;
export type RegistrationRow = typeof registrations.$inferSelect;
