// The student's study-plan checklist, served entirely from the local MariaDB
// database (see scripts/seed.mjs for the demo data). This replaces the live
// university-portal scraping of the original project: the same `Checklist`
// shape is built from the students / checklist_categories / checklist_courses
// tables, so the dashboard components are unchanged.
import { randomBytes } from "crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { students, checklistCategories, checklistCourses } from "@/db/schema";
import { verifyPassword, hashPassword } from "@/lib/passwords";
import { fetchBuChecklist } from "@/lib/buChecklist";

export interface AuthResult {
  ok: boolean;
  message?: string;
}

export interface Course {
  code: string;
  name: string;
  credit: string;
  grade: string;
  note: string;
}

export interface CourseGroup {
  group: string;
  courses: Course[];
}

export interface Category {
  category: string;
  creditEarned: number | null;
  creditRequired: number | null;
  groups: CourseGroup[];
}

export interface InfoItem {
  label: string;
  value: string;
}

export interface StudentInfo {
  nameTh: string;
  nameEn: string;
  studentId: string;
  photo: string;
  info: InfoItem[];
  gpa: string;
  totalCredits: string;
  creditsEarned: string;
  creditsTransferred: string;
}

export interface Checklist {
  student: StudentInfo;
  categories: Category[];
}

/** Authenticate a demo student against the local students table. */
export async function authenticate(username: string, password: string): Promise<AuthResult> {
  const [student] = await db
    .select({ passwordHash: students.passwordHash })
    .from(students)
    .where(eq(students.username, username))
    .limit(1);

  if (!student || !verifyPassword(password, student.passwordHash)) {
    return { ok: false, message: "Invalid username or password." };
  }
  return { ok: true };
}

/**
 * Authenticate a real BU student against studentchecklist.bu.ac.th and mirror
 * their scraped checklist into the local students / checklist_categories /
 * checklist_courses tables — the same tables and shape the demo account uses,
 * so the dashboard, plan builder, and registration all work unchanged. Their
 * BU password is only ever forwarded to BU over HTTPS for this one check; it
 * is never stored.
 */
export async function loginWithBu(username: string, password: string): Promise<AuthResult> {
  const result = await fetchBuChecklist(username, password);
  if (!result.ok) return { ok: false, message: result.message };
  await syncBuChecklist(username, result.checklist);
  return { ok: true };
}

/**
 * Upsert a student's profile + replace their checklist categories/courses
 * with freshly scraped BU data. Plans, saved schedules, and registrations
 * (keyed off the same students.id) are untouched — those are local-only
 * features BU's real system has no notion of.
 */
async function syncBuChecklist(username: string, checklist: Checklist): Promise<void> {
  const { student } = checklist;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: students.id })
      .from(students)
      .where(eq(students.username, username))
      .limit(1);

    const profile = {
      nameTh: student.nameTh,
      nameEn: student.nameEn,
      studentId: student.studentId,
      photo: student.photo,
      gpa: student.gpa,
      totalCredits: student.totalCredits,
      creditsEarned: student.creditsEarned,
      creditsTransferred: student.creditsTransferred,
      info: student.info,
    };

    let studentDbId: number;
    if (existing) {
      studentDbId = existing.id;
      await tx.update(students).set(profile).where(eq(students.id, studentDbId));
      // Cascades to checklist_courses via the FK's onDelete: "cascade".
      await tx.delete(checklistCategories).where(eq(checklistCategories.studentId, studentDbId));
    } else {
      // BU accounts always authenticate live against BU, never against this
      // hash — a random value just satisfies the NOT NULL column.
      const [res] = await tx
        .insert(students)
        .values({ username, passwordHash: hashPassword(randomBytes(32).toString("hex")), ...profile });
      studentDbId = res.insertId;
    }

    for (const [catPos, cat] of checklist.categories.entries()) {
      const [catRes] = await tx.insert(checklistCategories).values({
        studentId: studentDbId,
        position: catPos,
        name: cat.category,
        creditEarned: cat.creditEarned,
        creditRequired: cat.creditRequired,
      });
      const categoryId = catRes.insertId;

      let coursePos = 0;
      for (const group of cat.groups) {
        for (const course of group.courses) {
          await tx.insert(checklistCourses).values({
            categoryId,
            position: coursePos++,
            groupName: group.group,
            code: course.code,
            name: course.name,
            credit: course.credit,
            grade: course.grade,
            note: course.note,
          });
        }
      }
    }
  });
}

/** Load a student's full checklist. Returns null when the account doesn't exist. */
export async function getChecklist(username: string): Promise<Checklist | null> {
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.username, username))
    .limit(1);
  if (!student) return null;

  const categories = await db
    .select()
    .from(checklistCategories)
    .where(eq(checklistCategories.studentId, student.id))
    .orderBy(asc(checklistCategories.position));

  const courses = categories.length
    ? await db
        .select()
        .from(checklistCourses)
        .where(inArray(checklistCourses.categoryId, categories.map((c) => c.id)))
        .orderBy(asc(checklistCourses.position))
    : [];

  // Rebuild the two-level category → group → course hierarchy, preserving each
  // group's first-seen order within its category.
  const built: Category[] = categories.map((cat) => {
    const groups: CourseGroup[] = [];
    for (const row of courses) {
      if (row.categoryId !== cat.id) continue;
      let group = groups.find((g) => g.group === row.groupName);
      if (!group) {
        group = { group: row.groupName, courses: [] };
        groups.push(group);
      }
      group.courses.push({
        code: row.code,
        name: row.name,
        credit: row.credit,
        grade: row.grade,
        note: row.note,
      });
    }
    return {
      category: cat.name,
      creditEarned: cat.creditEarned,
      creditRequired: cat.creditRequired,
      groups,
    };
  });

  return {
    student: {
      nameTh: student.nameTh,
      nameEn: student.nameEn,
      studentId: student.studentId,
      photo: student.photo,
      info: student.info ?? [],
      gpa: student.gpa,
      totalCredits: student.totalCredits,
      creditsEarned: student.creditsEarned,
      creditsTransferred: student.creditsTransferred,
    },
    categories: built,
  };
}
