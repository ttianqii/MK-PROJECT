// Pure, client-safe helpers for the next-term planner (no DB imports, so it is
// safe to pull into client components). Types-only import of ScheduleSlot is
// erased at compile time.
import type { ScheduleSlot } from "@/lib/scheduleQueries";

/** Days shown as timetable rows, with the short labels used in the header. */
export const DAYS: { full: string; short: string }[] = [
  { full: "Sunday", short: "SUN" },
  { full: "Monday", short: "MON" },
  { full: "Tuesday", short: "TUE" },
  { full: "Wednesday", short: "WED" },
  { full: "Thursday", short: "THU" },
  { full: "Friday", short: "FRI" },
  { full: "Saturday", short: "SAT" },
];

/** A single meeting time of a planned section. */
export interface Meeting {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  roomCapacity: number | null;
  startMin: number;
  endMin: number;
}

/** A course section (all its weekly meetings) that a student can add to a plan. */
export interface PlanSection {
  key: string; // `${courseCode}·${section}`
  courseCode: string;
  courseName: string;
  section: string | null;
  capacity: number | null; // representative room capacity (for the legend)
  meetings: Meeting[];
}

/** "8.40" | "08:40" -> minutes since midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(/[.:]/);
  return Number(h) * 60 + Number(m ?? 0);
}

/** 520 -> "08:40". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function sectionKey(courseCode: string, section: string | null): string {
  return `${courseCode}·${section ?? ""}`;
}

/**
 * Collapse the flat offered-slot list into course sections. A section's weekly
 * footprint is every slot sharing the same course code + section.
 */
export function groupSections(slots: ScheduleSlot[]): PlanSection[] {
  const byKey = new Map<string, PlanSection>();

  for (const s of slots) {
    const key = sectionKey(s.courseCode, s.section);
    let sec = byKey.get(key);
    if (!sec) {
      sec = {
        key,
        courseCode: s.courseCode,
        courseName: s.courseName,
        section: s.section,
        capacity: s.roomCapacity,
        meetings: [],
      };
      byKey.set(key, sec);
    }
    // Dedupe identical meetings (same day/time/room seen more than once).
    const dupe = sec.meetings.some(
      (m) => m.day === s.day && m.startTime === s.startTime && m.room === s.room
    );
    if (!dupe) {
      sec.meetings.push({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        roomCapacity: s.roomCapacity,
        startMin: toMinutes(s.startTime),
        endMin: toMinutes(s.endTime),
      });
    }
  }

  for (const sec of byKey.values()) {
    sec.meetings.sort((a, b) => a.startMin - b.startMin);
  }
  return [...byKey.values()].sort(
    (a, b) => a.courseCode.localeCompare(b.courseCode) || (a.section ?? "").localeCompare(b.section ?? "")
  );
}

/** Two meetings collide if they share a day and their time ranges overlap. */
export function meetingsConflict(a: Meeting, b: Meeting): boolean {
  return a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin;
}

export interface ConflictResult {
  /** keys of sections that overlap another in time */
  timeSet: Set<string>;
  /** keys of sections sharing a course code with another (added twice) */
  dupSet: Set<string>;
  /** union of the above, for outlining on the grid */
  all: Set<string>;
}

/**
 * Find clashes among planned sections: a *duplicate* is more than one section of
 * the same course code, and a *time* clash is two sections with overlapping
 * meetings.
 */
export function detectConflicts(planned: PlanSection[]): ConflictResult {
  const timeSet = new Set<string>();
  const dupSet = new Set<string>();

  const byCode = new Map<string, PlanSection[]>();
  for (const s of planned) {
    const list = byCode.get(s.courseCode) ?? [];
    list.push(s);
    byCode.set(s.courseCode, list);
  }
  for (const list of byCode.values()) {
    if (list.length > 1) for (const s of list) dupSet.add(s.key);
  }

  for (let i = 0; i < planned.length; i++) {
    for (let j = i + 1; j < planned.length; j++) {
      const clash = planned[i].meetings.some((a) =>
        planned[j].meetings.some((b) => meetingsConflict(a, b))
      );
      if (clash) {
        timeSet.add(planned[i].key);
        timeSet.add(planned[j].key);
      }
    }
  }

  return { timeSet, dupSet, all: new Set([...timeSet, ...dupSet]) };
}

// Solid block colors in the reference design's order (blue, green, orange,
// purple, yellow, red, …) so every section in a schedule gets a distinct hue.
const PALETTE = [
  "#2E86D6",
  "#3DA83D",
  "#E8842B",
  "#8E5AC9",
  "#E0A82E",
  "#C43D3D",
  "#2AA79B",
  "#E11D62",
  "#C97B5A",
  "#7A8290",
];

/** Deterministic color for a section key, stable across add/remove. */
export function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/**
 * Palette colors assigned by position, like the reference: the schedule's
 * first section is blue, the second green, and so on — never two the same
 * until the palette runs out.
 */
export function sectionColors(sections: PlanSection[]): Map<string, string> {
  return new Map(sections.map((s, i) => [s.key, PALETTE[i % PALETTE.length]]));
}
