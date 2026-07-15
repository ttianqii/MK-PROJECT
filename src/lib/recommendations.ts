// Suggest which still-needed Study Plan courses to take next term: any checklist
// course the student hasn't passed yet that is actually offered this term.
// Pure (no DB / network), so it can run in the server component or be tested.
import type { Checklist } from "@/lib/checklist";
import type { PlanSection } from "@/lib/timetable";

export interface RecommendedCourse {
  code: string;
  name: string;
  category: string; // Study Plan category the course belongs to
  credit: string;
  grade: string; // "" (never taken), or a non-passing grade: F/U/I (retake) or W (withdrawn)
  sectionCount: number; // sections offered this term
}

// Not passed yet: no grade, a placeholder, or an explicitly non-passing grade.
const NON_PASSING = /^(F|W|I|U|IP|NP|NC)$/i;
function stillNeeded(grade: string): boolean {
  const g = grade.trim();
  return g === "" || g === "-" || NON_PASSING.test(g);
}

// Passed at least once = a real, non-empty, non-failing grade.
function isPassed(grade: string): boolean {
  const g = grade.trim();
  return g !== "" && g !== "-" && !NON_PASSING.test(g);
}

function shortCategory(category: string): string {
  return category.replace(/\s*\(Credit earned:.*\)\s*/i, "").trim();
}

/**
 * Cross-reference the checklist against the offered sections. Returns each
 * still-needed course that has at least one section this term, de-duplicated by
 * course code and preserving the checklist's category ordering.
 *
 * A course is treated as done — and therefore never recommended — if it carries
 * a passing grade *anywhere* in the checklist. This matters because the same
 * course can appear more than once (e.g. as a completed requirement and again as
 * an open elective slot); a blank elective row must not resurrect a course the
 * student has already passed.
 */
export function recommendCourses(
  checklist: Checklist,
  sections: PlanSection[]
): RecommendedCourse[] {
  const countByCode = new Map<string, number>();
  for (const s of sections) {
    countByCode.set(s.courseCode, (countByCode.get(s.courseCode) ?? 0) + 1);
  }

  // First pass: every course the student has already passed, by code.
  const completed = new Set<string>();
  for (const cat of checklist.categories) {
    for (const grp of cat.groups) {
      for (const c of grp.courses) {
        if (isPassed(c.grade)) completed.add(c.code.trim().toUpperCase());
      }
    }
  }

  const seen = new Set<string>();
  const out: RecommendedCourse[] = [];

  for (const cat of checklist.categories) {
    for (const grp of cat.groups) {
      for (const c of grp.courses) {
        const code = c.code.trim().toUpperCase();
        if (!code || seen.has(code)) continue;
        if (completed.has(code)) continue; // already taken/completed — skip
        if (!stillNeeded(c.grade)) continue;

        const sectionCount = countByCode.get(code) ?? 0;
        if (sectionCount === 0) continue; // not offered this term

        seen.add(code);
        out.push({
          code,
          name: c.name,
          category: shortCategory(cat.category),
          credit: c.credit,
          grade: c.grade.trim(),
          sectionCount,
        });
      }
    }
  }

  return out;
}

/**
 * Every course the student still needs (hasn't passed yet), whether or not it
 * is offered this term — for the "วิชาที่ยังขาด" (subjects still lacking) tab.
 * Same de-duplication and completed-course rules as recommendCourses, minus
 * the "offered this term" filter; sectionCount is 0 for courses with no
 * sections this term.
 */
export function stillNeededCourses(
  checklist: Checklist,
  sections: PlanSection[]
): RecommendedCourse[] {
  const countByCode = new Map<string, number>();
  for (const s of sections) {
    countByCode.set(s.courseCode, (countByCode.get(s.courseCode) ?? 0) + 1);
  }

  const completed = new Set<string>();
  for (const cat of checklist.categories) {
    for (const grp of cat.groups) {
      for (const c of grp.courses) {
        if (isPassed(c.grade)) completed.add(c.code.trim().toUpperCase());
      }
    }
  }

  const seen = new Set<string>();
  const out: RecommendedCourse[] = [];

  for (const cat of checklist.categories) {
    for (const grp of cat.groups) {
      for (const c of grp.courses) {
        const code = c.code.trim().toUpperCase();
        if (!code || seen.has(code)) continue;
        if (completed.has(code)) continue;
        if (!stillNeeded(c.grade)) continue;

        seen.add(code);
        out.push({
          code,
          name: c.name,
          category: shortCategory(cat.category),
          credit: c.credit,
          grade: c.grade.trim(),
          sectionCount: countByCode.get(code) ?? 0,
        });
      }
    }
  }

  return out;
}
