// Server-side reads of the stored URSA room schedule (see src/db/seed.ts).
import { db } from "@/db";
import { classSchedule, type ClassScheduleRow } from "@/db/schema";

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** A single class meeting, trimmed to what the schedule browser needs. */
export interface ScheduleSlot {
  day: string;
  room: string;
  roomCapacity: number | null;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  section: string | null;
}

export interface ScheduleData {
  campus: string;
  semester: string;
  days: string[]; // days present, in week order
  slots: ScheduleSlot[]; // sorted by day, then start time, then room
}

/** "8.40" -> 520 (minutes since midnight) for chronological sorting. */
function toMinutes(time: string): number {
  const [h, m] = time.split(".");
  return Number(h) * 60 + Number(m ?? 0);
}

function dayRank(day: string): number {
  const i = DAY_ORDER.indexOf(day);
  return i === -1 ? DAY_ORDER.length : i;
}

/** Load the whole stored schedule, ready for client-side filtering. */
export async function getSchedule(): Promise<ScheduleData> {
  const rows = (await db.select().from(classSchedule)) as ClassScheduleRow[];

  const slots: ScheduleSlot[] = rows
    .map((r) => ({
      day: r.day,
      room: r.room,
      roomCapacity: r.roomCapacity,
      startTime: r.startTime,
      endTime: r.endTime,
      courseCode: r.courseCode,
      courseName: r.courseName,
      section: r.section,
    }))
    .sort(
      (a, b) =>
        dayRank(a.day) - dayRank(b.day) ||
        toMinutes(a.startTime) - toMinutes(b.startTime) ||
        a.room.localeCompare(b.room)
    );

  const days = [...new Set(slots.map((s) => s.day))].sort(
    (a, b) => dayRank(a) - dayRank(b)
  );

  return {
    campus: rows[0]?.campus ?? "",
    semester: rows[0]?.semester ?? "",
    days,
    slots,
  };
}
