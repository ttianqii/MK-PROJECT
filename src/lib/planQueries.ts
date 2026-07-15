// Server-side reads/writes for saved plans, their schedules, and the
// registration snapshot (see plans / plan_schedules / registrations in
// src/db/schema.ts).
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  plans,
  planSchedules,
  registrations,
  students,
  type PlanRow,
  type PlanScheduleRow,
  type RegistrationRow,
} from "@/db/schema";

/** The slice of the student row the plan screens show in their header. */
export interface PlanStudent {
  id: number;
  studentId: string;
  nameEn: string;
  photo: string;
}

export async function getStudentByUsername(username: string): Promise<PlanStudent | null> {
  const [s] = await db
    .select({
      id: students.id,
      studentId: students.studentId,
      nameEn: students.nameEn,
      photo: students.photo,
    })
    .from(students)
    .where(eq(students.username, username))
    .limit(1);
  return s ?? null;
}

export interface PlanWithSchedules {
  plan: PlanRow;
  schedules: PlanScheduleRow[];
}

/** Load the student's plan, creating an empty "Plan 1" on first visit. */
export async function getOrCreatePlan(studentDbId: number): Promise<PlanWithSchedules> {
  let [plan] = await db.select().from(plans).where(eq(plans.studentId, studentDbId)).limit(1);
  if (!plan) {
    await db.insert(plans).values({ studentId: studentDbId }).$returningId();
    [plan] = await db.select().from(plans).where(eq(plans.studentId, studentDbId)).limit(1);
  }

  const schedules = await db
    .select()
    .from(planSchedules)
    .where(eq(planSchedules.planId, plan.id))
    .orderBy(asc(planSchedules.position), asc(planSchedules.id));

  return { plan, schedules };
}

/** Append a schedule to the plan and return its row. */
export async function addSchedule(
  studentDbId: number,
  sectionKeys: string[],
  title = ""
): Promise<PlanScheduleRow> {
  const { plan, schedules } = await getOrCreatePlan(studentDbId);
  const position = (schedules.at(-1)?.position ?? 0) + 1;
  const [{ id }] = await db
    .insert(planSchedules)
    .values({ planId: plan.id, position, sectionKeys, title })
    .$returningId();
  // Any schedule change also counts as a plan update (drives "UPDATED AT …").
  await db.update(plans).set({ updatedAt: new Date() }).where(eq(plans.id, plan.id));
  const [row] = await db.select().from(planSchedules).where(eq(planSchedules.id, id)).limit(1);
  return row;
}

/** Update a schedule the student owns. Returns false when it isn't theirs. */
export async function updateSchedule(
  studentDbId: number,
  scheduleId: number,
  patch: { title?: string; liked?: boolean; sectionKeys?: string[] }
): Promise<boolean> {
  const owned = await getOwnedSchedule(studentDbId, scheduleId);
  if (!owned) return false;
  await db.update(planSchedules).set(patch).where(eq(planSchedules.id, scheduleId));
  return true;
}

export async function deleteSchedule(studentDbId: number, scheduleId: number): Promise<boolean> {
  const owned = await getOwnedSchedule(studentDbId, scheduleId);
  if (!owned) return false;
  await db.delete(planSchedules).where(eq(planSchedules.id, scheduleId));
  return true;
}

async function getOwnedSchedule(
  studentDbId: number,
  scheduleId: number
): Promise<PlanScheduleRow | null> {
  const [row] = await db
    .select({ schedule: planSchedules })
    .from(planSchedules)
    .innerJoin(plans, eq(planSchedules.planId, plans.id))
    .where(and(eq(planSchedules.id, scheduleId), eq(plans.studentId, studentDbId)))
    .limit(1);
  return row?.schedule ?? null;
}

/** Fetch one saved schedule the student owns (for the detail / edit pages). */
export async function getScheduleById(
  studentDbId: number,
  scheduleId: number
): Promise<PlanScheduleRow | null> {
  return getOwnedSchedule(studentDbId, scheduleId);
}

/** Register a schedule's sections for the semester, replacing any previous registration. */
export async function registerSchedule(
  studentDbId: number,
  scheduleId: number,
  semester: string
): Promise<boolean> {
  const owned = await getOwnedSchedule(studentDbId, scheduleId);
  if (!owned) return false;

  await db
    .insert(registrations)
    .values({ studentId: studentDbId, semester, sectionKeys: owned.sectionKeys })
    .onDuplicateKeyUpdate({ set: { sectionKeys: owned.sectionKeys } });
  return true;
}

export async function getRegistration(
  studentDbId: number,
  semester: string
): Promise<RegistrationRow | null> {
  const [row] = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.studentId, studentDbId), eq(registrations.semester, semester)))
    .limit(1);
  return row ?? null;
}
