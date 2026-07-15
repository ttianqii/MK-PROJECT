// A course-section detail card in the reference layout: a colored vertical
// accent line on the left, the course code (top-left) on the same line as the
// section (top-right), the course name beneath, an optional prerequisite line,
// then one day / time / building row per meeting. Shared by the plan detail
// page and the registration result page so both render identically.
import { DAYS, formatMinutes, type PlanSection } from "@/lib/timetable";

const DAY_SHORT = new Map(DAYS.map((d) => [d.full, d.short]));

export default function SubjectDetailCard({
  section,
  color,
  prereq = [],
}: {
  section: PlanSection;
  color: string;
  prereq?: string[]; // prerequisite course code(s), shown as a sub-line
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 pl-5 shadow-sm sm:p-5 sm:pl-6">
      {/* Colored accent line */}
      <span
        className="absolute inset-y-3 left-0 w-1.5 rounded-r-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      {/* Header: course code (left) + section (right) */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-lg font-bold text-gray-900">{section.courseCode}</p>
        {section.section ? (
          <p className="shrink-0 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Section {section.section}
          </p>
        ) : null}
      </div>

      {/* Course name */}
      <p className="mt-0.5 text-sm font-medium uppercase text-gray-700">{section.courseName}</p>

      {/* Prerequisite line */}
      {prereq.length > 0 ? (
        <p className="mt-0.5 text-xs text-gray-400">ต้องผ่านก่อน: {prereq.join(", ")}</p>
      ) : null}

      {/* Day / time / building rows */}
      <dl className="mt-4 divide-y divide-gray-100">
        {section.meetings.map((m, i) => (
          <div key={i} className="flex gap-5 py-3 first:pt-0 last:pb-0">
            <dt className="w-11 shrink-0 pt-0.5 text-sm font-bold uppercase text-gray-800">
              {DAY_SHORT.get(m.day) ?? m.day}
            </dt>
            <dd className="min-w-0">
              <p className="text-base text-gray-800">
                {formatMinutes(m.startMin)} - {formatMinutes(m.endMin)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path
                    fill="currentColor"
                    d="M21 19h2v2H1v-2h2V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15h2V9h3a1 1 0 0 1 1 1zM7 11v2h4v-2zm0-4v2h4V7z"
                  />
                </svg>
                {m.room || "ยังไม่ระบุห้อง"}
              </p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
