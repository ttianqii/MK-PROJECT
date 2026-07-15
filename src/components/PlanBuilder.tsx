"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduleData } from "@/lib/scheduleQueries";
import type { RecommendedCourse } from "@/lib/recommendations";
import {
  colorFor,
  detectConflicts,
  formatMinutes,
  groupSections,
  type PlanSection,
} from "@/lib/timetable";
import TimetableGrid from "./TimetableGrid";

const STORAGE_KEY = "sp:nextTermPlan";
const DAY_ABBR: Record<string, string> = {
  Sunday: "Sun",
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
};

function meetingLabel(s: PlanSection): string {
  return s.meetings
    .map((m) => `${DAY_ABBR[m.day] ?? m.day} ${formatMinutes(m.startMin)}–${formatMinutes(m.endMin)} · ${m.room}`)
    .join("  •  ");
}

export default function PlanBuilder({
  data,
  recommendations = [],
}: {
  data: ScheduleData;
  recommendations?: RecommendedCourse[];
}) {
  const allSections = useMemo(() => groupSections(data.slots), [data.slots]);
  const byKey = useMemo(() => new Map(allSections.map((s) => [s.key, s])), [allSections]);

  const [keys, setKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");

  // Load / persist the plan in localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // localStorage is only readable after mount; setting state here (not in
      // the initializer) keeps server and client first renders identical.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setKeys(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  }, [keys, loaded]);

  const planned = useMemo(
    () => keys.map((k) => byKey.get(k)).filter((s): s is PlanSection => Boolean(s)),
    [keys, byKey]
  );

  // Clashes between planned sections: duplicate course code and/or time overlap.
  const { timeSet, dupSet, all: conflicting } = useMemo(
    () => detectConflicts(planned),
    [planned]
  );

  const plannedCodes = useMemo(
    () => new Set(planned.map((s) => s.courseCode)),
    [planned]
  );

  const add = (key: string) => setKeys((ks) => (ks.includes(key) ? ks : [...ks, key]));
  const remove = (key: string) => setKeys((ks) => ks.filter((k) => k !== key));

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return allSections
      .filter(
        (s) =>
          s.courseCode.toLowerCase().includes(q) ||
          s.courseName.toLowerCase().includes(q) ||
          (s.section?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 40);
  }, [allSections, q]);

  return (
    <div className="space-y-6">
      <TimetableGrid sections={planned} conflictKeys={conflicting} />

      {conflicting.size > 0 ? (
        <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dupSet.size > 0 ? (
            <p>⚠ You&apos;ve added more than one section of the same course.</p>
          ) : null}
          {timeSet.size > 0 ? <p>⚠ Some classes overlap in time.</p> : null}
          <p className="text-xs text-red-500">Conflicting sections are outlined in red on the grid.</p>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-blue-900">Recommended this term</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {recommendations.length}
            </span>
          </div>
          <p className="mb-3 text-xs text-blue-800/80">
            Courses from your Study Plan that you still need and that are offered this term. Click one
            to find its sections.
          </p>
          <div className="flex flex-wrap gap-2">
            {recommendations.map((r) => {
              const inPlan = plannedCodes.has(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setQuery(r.code)}
                  title={`${r.name}\n${r.category}${r.grade ? `\nprevious grade: ${r.grade}` : ""}\n${r.sectionCount} section${r.sectionCount === 1 ? "" : "s"} offered`}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
                    inPlan
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-blue-200 bg-white text-gray-800 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  <span className="font-mono font-semibold">{r.code}</span>
                  <span className="max-w-[10rem] truncate text-xs text-gray-500">{r.name}</span>
                  {r.grade ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                      {/^W$/i.test(r.grade) ? "withdrawn (W)" : `retake ${r.grade}`}
                    </span>
                  ) : null}
                  <span className="text-xs text-gray-400">
                    {inPlan ? "✓ in plan" : `${r.sectionCount} S.`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Add classes */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Add classes
          </h2>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by course code, name, or section…"
              aria-label="Search classes to add"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto">
            {q && results.length === 0 ? (
              <p className="px-1 py-2 text-sm text-gray-500">No classes match “{query}”.</p>
            ) : null}
            {results.map((s) => {
              const added = keys.includes(s.key);
              return (
                <div
                  key={s.key}
                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-mono font-semibold text-gray-900">{s.courseCode}</span>
                      {s.section ? <span className="ml-2 text-gray-500">S.{s.section}</span> : null}
                    </p>
                    <p className="truncate text-xs text-gray-500">{s.courseName}</p>
                    <p className="mt-1 text-xs text-gray-400">{meetingLabel(s)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => add(s.key)}
                    disabled={added}
                    className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
                      added
                        ? "cursor-default bg-gray-100 text-gray-400"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {added ? "Added" : "Add"}
                  </button>
                </div>
              );
            })}
            {!q ? (
              <p className="px-1 py-2 text-sm text-gray-400">
                Start typing to find classes to add to your plan.
              </p>
            ) : null}
          </div>
        </section>

        {/* Your plan */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Your plan {planned.length > 0 ? `(${planned.length})` : ""}
          </h2>
          {planned.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              No classes yet. Search and add sections to build your next-term timetable.
            </div>
          ) : (
            <ul className="space-y-2">
              {planned.map((s) => (
                <li
                  key={s.key}
                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="flex min-w-0 gap-3">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(s.key) }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-mono font-semibold text-gray-900">{s.courseCode}</span>
                        {s.section ? <span className="ml-2 text-gray-500">S.{s.section}</span> : null}
                        {dupSet.has(s.key) ? (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            duplicate course
                          </span>
                        ) : null}
                        {timeSet.has(s.key) ? (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            time conflict
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-gray-500">{s.courseName}</p>
                      <p className="mt-1 text-xs text-gray-400">{meetingLabel(s)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(s.key)}
                    aria-label={`Remove ${s.courseCode}`}
                    className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
