"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PopUpAlert from "./PopUpAlert";
import BottomSheet from "./BottomSheet";
import type { ScheduleData } from "@/lib/scheduleQueries";
import type { RecommendedCourse, Eligibility } from "@/lib/recommendations";
import {
  detectConflicts,
  formatMinutes,
  groupCourses,
  groupSections,
  sectionColors,
  sectionSeats,
  type PlanSection,
} from "@/lib/timetable";
import TimetableGrid from "./TimetableGrid";
import EditableTitle from "./EditableTitle";
import ScheduleCard from "./ScheduleCard";

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

interface StoredPlan {
  subjects: string[];
  chosen: Record<string, string>;
}

/** Read the saved plan, migrating the old flat section-key array if present. */
function loadStored(): StoredPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { subjects: [], chosen: {} };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const subjects: string[] = [];
      const chosen: Record<string, string> = {};
      for (const key of parsed) {
        const code = String(key).split("·")[0];
        if (!subjects.includes(code)) subjects.push(code);
        chosen[code] = key;
      }
      return { subjects, chosen };
    }
    if (parsed && typeof parsed === "object") {
      return { subjects: parsed.subjects ?? [], chosen: parsed.chosen ?? {} };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { subjects: [], chosen: {} };
}

type SheetTab = "recommend" | "needed" | "search";

const SHEET_TABS: { id: SheetTab; label: string }[] = [
  { id: "recommend", label: "Recommend" },
  { id: "needed", label: "วิชาที่ยังขาด" },
  { id: "search", label: "Search" },
];

export default function PlanBuilder({
  data,
  recommendations = [],
  needed = [],
  eligibility = { passed: [], prereqByCode: {}, checklistCodes: [] },
}: {
  data: ScheduleData;
  recommendations?: RecommendedCourse[];
  needed?: RecommendedCourse[];
  eligibility?: Eligibility;
}) {
  const allSections = useMemo(() => groupSections(data.slots), [data.slots]);
  const byKey = useMemo(() => new Map(allSections.map((s) => [s.key, s])), [allSections]);
  const courses = useMemo(() => groupCourses(allSections), [allSections]);
  const courseByCode = useMemo(() => new Map(courses.map((c) => [c.courseCode, c])), [courses]);

  // Registration eligibility from the student's real checklist.
  const passedSet = useMemo(() => new Set(eligibility.passed), [eligibility.passed]);
  const checklistSet = useMemo(() => new Set(eligibility.checklistCodes), [eligibility.checklistCodes]);
  // Prereq status for a course: its prerequisite code(s) and whether they're met.
  const prereqInfo = (code: string) => {
    const pres = eligibility.prereqByCode[code.toUpperCase()] ?? [];
    const unmet = pres.filter((p) => !passedSet.has(p));
    return { prereq: pres, prereqMet: unmet.length === 0 };
  };

  const router = useRouter();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // Add-subject sheet + section picker.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<SheetTab>("recommend");
  const [query, setQuery] = useState("");
  const [pickerCode, setPickerCode] = useState<string | null>(null);
  const activeTabIndex = SHEET_TABS.findIndex((t) => t.id === tab);

  // Load / persist the plan in localStorage.
  useEffect(() => {
    // Hydrate from localStorage after mount (it's unreadable during SSR, so the
    // first render must match the server's empty state, then fill in here).
    const stored = loadStored();
    /* eslint-disable react-hooks/set-state-in-effect */
    setSubjects(stored.subjects);
    setChosen(stored.chosen);
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ subjects, chosen }));
  }, [subjects, chosen, loaded]);

  // The bottom-nav "+" (see DashboardHeader) opens the sheet via this event.
  useEffect(() => {
    const open = () => setSheetOpen(true);
    window.addEventListener("mk:add-subject", open);
    return () => window.removeEventListener("mk:add-subject", open);
  }, []);

  const planned = useMemo(
    () =>
      subjects
        .map((code) => (chosen[code] ? byKey.get(chosen[code]) : undefined))
        .filter((s): s is PlanSection => Boolean(s)),
    [subjects, chosen, byKey]
  );

  const { timeSet, dupSet, all: conflicting } = useMemo(() => detectConflicts(planned), [planned]);
  const plannedColors = useMemo(() => sectionColors(planned), [planned]);

  const addSubject = (code: string) =>
    setSubjects((s) => (s.includes(code) ? s : [...s, code]));

  const removeSubject = (code: string) => {
    setSubjects((s) => s.filter((c) => c !== code));
    setChosen((c) => {
      const next = { ...c };
      delete next[code];
      return next;
    });
  };

  const chooseSection = (code: string, key: string) => {
    setChosen((c) => ({ ...c, [code]: key }));
    setPickerCode(null);
  };

  // Subjects added but still without a chosen section — must be resolved
  // before saving.
  const missingSection = useMemo(() => subjects.filter((c) => !chosen[c]), [subjects, chosen]);

  // Persist the current selection as a new schedule card on the My Plan page.
  const saveToPlan = async () => {
    if (subjects.length === 0) {
      PopUpAlert("Nothing to save", "Add a subject and choose a section first.", "warning");
      return;
    }
    if (missingSection.length > 0) {
      PopUpAlert(
        "เลือก section ให้ครบก่อน",
        `ยังไม่ได้เลือก section ของ: ${missingSection.join(", ")}`,
        "warning"
      );
      setPickerCode(missingSection[0]); // jump straight to the first one
      return;
    }
    const keys = subjects.map((c) => chosen[c]);
    setSaving(true);
    try {
      const res = await fetch("/api/plan/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys, title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        PopUpAlert("Save failed", data.message ?? "Please try again.", "error");
        return;
      }
      PopUpAlert("Saved!", "Added to My Plan as a new schedule.", "success", {
        imageUrl: "/save.gif",
      });
      router.push("/dashboard/plan");
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return courses
      .filter((c) => {
        // Hide courses restricted to another program (name has "(for XXX)")
        // unless they're in the student's own curriculum — those are the ones
        // they have no right to register for.
        const restricted = /\(for\s/i.test(c.courseName);
        if (restricted && !checklistSet.has(c.courseCode.toUpperCase())) return false;
        return c.courseCode.toLowerCase().includes(q) || c.courseName.toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [courses, q, checklistSet]);

  const pickerCourse = pickerCode ? courseByCode.get(pickerCode) : null;

  return (
    <div className="space-y-6">
      {/* Timetable of the chosen sections */}
      <ScheduleCard>
        <div className="mb-2">
          <EditableTitle value={title} placeholder="New Schedule" onSave={setTitle} />
        </div>
        <TimetableGrid sections={planned} conflictKeys={conflicting} />
      </ScheduleCard>

      {conflicting.size > 0 ? (
        <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dupSet.size > 0 ? (
            <p>⚠ You&apos;ve added more than one section of the same course.</p>
          ) : null}
          {timeSet.size > 0 ? <p>⚠ Some classes overlap in time.</p> : null}
          <p className="text-xs text-red-500">Conflicting sections are outlined in red on the grid.</p>
        </div>
      ) : null}

      {/* Subject list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Your subjects {subjects.length > 0 ? `(${subjects.length})` : ""}
          </h2>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-gray-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add subject
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            No subjects yet. Tap <span className="font-semibold text-gray-700">Add subject</span> to
            pick from your recommendations or search the catalog.
          </div>
        ) : (
          <ul className="space-y-2">
            {subjects.map((code) => {
              const course = courseByCode.get(code);
              const chosenKey = chosen[code];
              const chosenSec = chosenKey ? byKey.get(chosenKey) : undefined;
              const sectionCount = course?.sections.length ?? 0;
              return (
                <li
                  key={code}
                  className={`flex items-stretch justify-between gap-2 rounded-lg border bg-white ${
                    chosenSec ? "border-gray-200" : "border-amber-300 bg-amber-50/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPickerCode(code)}
                    aria-label={chosenSec ? `Change section for ${code}` : `Choose a section for ${code}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-l-lg p-3 text-left hover:bg-gray-50"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: chosenSec ? plannedColors.get(chosenSec.key) : "#F59E0B" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-mono font-semibold text-gray-900">{code}</span>
                        {chosenSec?.section ? (
                          <span className="ml-2 text-gray-500">S.{chosenSec.section}</span>
                        ) : null}
                        {dupSet.has(chosenSec?.key ?? "") ? (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            duplicate
                          </span>
                        ) : null}
                        {timeSet.has(chosenSec?.key ?? "") ? (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            time conflict
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-gray-500">{course?.courseName ?? code}</p>
                      {/* Subtitle: chosen section meeting (tap to change), or a prompt to choose */}
                      {chosenSec ? (
                        <p className="mt-1 text-xs text-gray-400">
                          {meetingLabel(chosenSec)}
                          <span className="ml-1 font-medium text-orange-500">· tap to change</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs font-semibold text-amber-600">
                          ⚠ choose a section — {sectionCount} available
                        </p>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSubject(code)}
                    aria-label={`Remove ${code}`}
                    className="shrink-0 rounded-r-lg px-3 text-sm text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {subjects.length > 0 ? (
          <div className="space-y-2">
            {missingSection.length > 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700">
                ⚠ เลือก section ให้ครบก่อนบันทึก — ยังขาด {missingSection.length} วิชา
              </p>
            ) : null}
            <button
              type="button"
              onClick={saveToPlan}
              disabled={saving}
              className={`w-full rounded-full py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow disabled:cursor-not-allowed disabled:opacity-60 ${
                missingSection.length > 0
                  ? "bg-gray-400 hover:bg-gray-500"
                  : "bg-gray-900 hover:bg-gray-700"
              }`}
            >
              {saving ? "Saving…" : "Save to My Plan"}
            </button>
          </div>
        ) : null}
      </section>

      {/* ── Add-subject slide-up sheet ─────────────────────────────────────── */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ariaLabel="Add subject"
        detents={[50, 82]}
        initial={82}
        header={
          <>
            <div className="px-5 pb-3 pt-1">
              <h2 className="text-lg font-bold text-gray-900">Add subject</h2>
            </div>
            {/* Animated black tab switcher */}
            <div className="relative mx-5 mb-3 grid grid-cols-3 rounded-full bg-gray-100 p-1 text-xs font-semibold">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1 rounded-full bg-gray-900 shadow-sm transition-transform duration-300 ease-out"
                style={{
                  width: "calc((100% - 0.5rem) / 3)",
                  left: "0.25rem",
                  transform: `translateX(${activeTabIndex * 100}%)`,
                }}
              />
              {SHEET_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative z-10 whitespace-nowrap rounded-full py-2 transition-colors ${
                    tab === t.id ? "text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        }
      >
          <div key={tab} className="animate-tab px-5 pb-8">
            {tab === "recommend" ? (
              recommendations.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No recommendations — every course in your plan is already passed or not offered
                  this term. Try the other tabs.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recommendations.map((r) => {
                    const { prereq, prereqMet } = prereqInfo(r.code);
                    return (
                      <SubjectRow
                        key={r.code}
                        code={r.code}
                        name={r.name}
                        sectionCount={r.sectionCount}
                        grade={r.grade}
                        added={subjects.includes(r.code)}
                        onAdd={() => addSubject(r.code)}
                        prereq={prereq}
                        prereqMet={prereqMet}
                      />
                    );
                  })}
                </ul>
              )
            ) : tab === "needed" ? (
              needed.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  You&apos;re not missing any subjects — every requirement is complete. 🎉
                </p>
              ) : (
                <ul className="space-y-2">
                  {needed.map((r) => {
                    const { prereq, prereqMet } = prereqInfo(r.code);
                    return (
                      <SubjectRow
                        key={r.code}
                        code={r.code}
                        name={r.name}
                        sectionCount={r.sectionCount}
                        grade={r.grade}
                        offered={r.sectionCount > 0}
                        added={subjects.includes(r.code)}
                        onAdd={() => addSubject(r.code)}
                        prereq={prereq}
                        prereqMet={prereqMet}
                      />
                    );
                  })}
                </ul>
              )
            ) : (
              <div className="space-y-3 pt-1 sm:pt-4">
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
                    placeholder="Search by course code or name…"
                    aria-label="Search subjects"
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {q && searchResults.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">No subjects match “{query}”.</p>
                ) : null}
                {!q ? (
                  <p className="py-6 text-center text-sm text-gray-400">
                    Start typing to find a subject to add.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {searchResults.map((c) => {
                      const { prereq, prereqMet } = prereqInfo(c.courseCode);
                      return (
                        <SubjectRow
                          key={c.courseCode}
                          code={c.courseCode}
                          name={c.courseName}
                          sectionCount={c.sections.length}
                          added={subjects.includes(c.courseCode)}
                          onAdd={() => addSubject(c.courseCode)}
                          prereq={prereq}
                          prereqMet={prereqMet}
                        />
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
      </BottomSheet>

      {/* ── Section picker sheet ───────────────────────────────────────────── */}
      <BottomSheet
        open={Boolean(pickerCode && pickerCourse)}
        onClose={() => setPickerCode(null)}
        ariaLabel={pickerCode ? `Choose a section for ${pickerCode}` : undefined}
        detents={[50, 82]}
        initial={82}
        header={
          pickerCourse ? (
            <div className="border-b border-gray-100 px-5 pb-3">
              <p className="font-mono text-base font-bold text-gray-900">{pickerCode}</p>
              <p className="truncate text-sm text-gray-500">{pickerCourse.courseName}</p>
              <p className="mt-0.5 text-xs uppercase tracking-wide text-gray-400">Choose a section</p>
            </div>
          ) : null
        }
      >
        {pickerCode && pickerCourse ? (
          <div className="space-y-2 p-4">
            {pickerCourse.sections.map((sec) => {
                const seats = sectionSeats(sec);
                const isChosen = chosen[pickerCode] === sec.key;
                const rooms = [...new Set(sec.meetings.map((m) => m.room).filter(Boolean))].join(", ");
                return (
                  <button
                    key={sec.key}
                    type="button"
                    disabled={seats.full && !isChosen}
                    onClick={() => chooseSection(pickerCode, sec.key)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isChosen
                        ? "border-green-300 bg-green-50"
                        : seats.full
                          ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70"
                          : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          Section {sec.section ?? "—"}
                        </p>
                        {rooms ? (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                            <BuildingGlyph />
                            {rooms}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {seats.full ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            FULL
                          </span>
                        ) : isChosen ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            Selected
                          </span>
                        ) : null}
                        {/* Seats as a plain number + icon (no bar) */}
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                          <SeatGlyph />
                          {seats.available}
                        </span>
                      </div>
                    </div>
                    {/* Mini weekly timetable: a bar shows when the class meets */}
                    <div className="mt-2">
                      <TimetableGrid sections={[sec]} showLegend={false} compact />
                    </div>
                  </button>
                );
            })}
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}

/** One selectable course row in the add-subject sheet. */
function SubjectRow({
  code,
  name,
  sectionCount,
  grade,
  added,
  onAdd,
  offered = true,
  prereq = [],
  prereqMet = true,
}: {
  code: string;
  name: string;
  sectionCount: number;
  grade?: string;
  added: boolean;
  onAdd: () => void;
  offered?: boolean; // false = still needed but not offered this term (can't add)
  prereq?: string[]; // prerequisite course code(s), if any
  prereqMet?: boolean; // false = a prerequisite hasn't been passed yet (can't add)
}) {
  // Blocked from registering: not offered this term, or a prerequisite is unmet.
  const blocked = !offered || !prereqMet;
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-mono font-semibold text-gray-900">{code}</span>
          {grade ? (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
              {/^W$/i.test(grade) ? "withdrawn (W)" : `retake ${grade}`}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-gray-500">{name}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {offered
            ? `${sectionCount} section${sectionCount === 1 ? "" : "s"}`
            : "not offered this term"}
        </p>
        {prereq.length > 0 ? (
          <p className={`mt-0.5 text-xs ${prereqMet ? "text-gray-400" : "text-amber-600"}`}>
            prereq: {prereq.join(", ")}
            {prereqMet ? " ✓" : " (ยังไม่ผ่าน)"}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={added || blocked}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
          added
            ? "cursor-default bg-green-100 text-green-700"
            : blocked
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : "bg-gray-900 text-white hover:bg-gray-700"
        }`}
      >
        {added ? "Added ✓" : blocked ? "—" : "Add +"}
      </button>
    </li>
  );
}

/** Small seat icon shown next to a section's available-seat number. */
function SeatGlyph() {
  return (
    <svg className="h-3.5 w-3.5 text-gray-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect width="12" height="10" x="6" y="2" rx="1" ry="1" />
      <path d="M4 15v2c0 .55.45 1 1 1h1v4h2v-4h8v4h2v-4h1c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1" />
    </svg>
  );
}

/** Small building icon shown next to a section's room/building. */
function BuildingGlyph() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M0 0h24v24H0z" fill="none" />
      <path
        fill="currentColor"
        d="M21 19h2v2H1v-2h2V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15h2V9h3a1 1 0 0 1 1 1zM7 11v2h4v-2zm0-4v2h4V7z"
      />
    </svg>
  );
}
