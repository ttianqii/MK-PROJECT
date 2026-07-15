// The student's study-plan checklist, served entirely from the local MariaDB
// database (see scripts/seed.mjs for the demo data). This replaces the live
// university-portal scraping of the original project: the same `Checklist`
// shape is built from the students / checklist_categories / checklist_courses
// tables, so the dashboard components are unchanged.
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { students, checklistCategories, checklistCourses } from "@/db/schema";
import { verifyPassword } from "@/lib/passwords";

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
