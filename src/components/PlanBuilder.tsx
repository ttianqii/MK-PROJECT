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
import { MeetingRows } from "./SubjectDetailCard";
import { PLAN_DRAFT_KEY } from "@/lib/planDraft";

const STORAGE_KEY = PLAN_DRAFT_KEY;
const DAY_ABBR: Record<string, string> = {
  Sunday: "SUN",
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
};

/** "MON 09:00-10:30, WED 13:00-14:30" — a section's meetings as text. */
function dayTimeText(s: PlanSection): string {
  return s.meetings
    .map((m) => `${DAY_ABBR[m.day] ?? m.day} ${formatMinutes(m.startMin)}-${formatMinutes(m.endMin)}`)
    .join(", ");
}

interface StoredPlan {
  subjects: string[];
  chosen: Record<string, string>;
}

/** Turn a flat list of section keys into the subjects/chosen shape. */
function subjectsFromKeys(keys: string[]): StoredPlan {
  const subjects: string[] = [];
  const chosen: Record<string, string> = {};
  for (const key of keys) {
    const code = String(key).split("·")[0];
    if (!subjects.includes(code)) subjects.push(code);
    chosen[code] = key;
  }
  return { subjects, chosen };
}

/** Read the saved plan, migrating the old flat section-key array if present. */
function loadStored(): StoredPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { subjects: [], chosen: {} };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return subjectsFromKeys(parsed);
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
  { id: "recommend", label: "แนะนำ" },
  { id: "needed", label: "วิชาที่ยังขาด" },
  { id: "search", label: "ค้นหา" },
];

export default function PlanBuilder({
  data,
  recommendations = [],
  needed = [],
  eligibility = { passed: [], prereqByCode: {}, checklistCodes: [] },
  editId,
  initialKeys,
  initialTitle = "",
}: {
  data: ScheduleData;
  recommendations?: RecommendedCourse[];
  needed?: RecommendedCourse[];
  eligibility?: Eligibility;
  // When set, edit an existing saved schedule (preload its sections; save via
  // PATCH) instead of building a new one from the localStorage draft.
  editId?: number;
  initialKeys?: string[];
  initialTitle?: string;
}) {
  const isEdit = editId != null;
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
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);

  // Add-subject sheet + section picker.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<SheetTab>("recommend");
  const [query, setQuery] = useState("");
  const [pickerCode, setPickerCode] = useState<string | null>(null);
  const activeTabIndex = SHEET_TABS.findIndex((t) => t.id === tab);

  // Load the working plan: from the edited schedule's keys in edit mode, or
  // from the localStorage draft when building a new one.
  useEffect(() => {
    const stored = isEdit
      ? subjectsFromKeys(initialKeys ?? [])
      : loadStored();
    /* eslint-disable react-hooks/set-state-in-effect */
    setSubjects(stored.subjects);
    setChosen(stored.chosen);
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the new-plan draft only (never overwrite it while editing).
  useEffect(() => {
    if (loaded && !isEdit) localStorage.setItem(STORAGE_KEY, JSON.stringify({ subjects, chosen }));
  }, [subjects, chosen, loaded, isEdit]);

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
      PopUpAlert("ยังไม่มีอะไรให้บันทึก", "เพิ่มวิชาและเลือก section ก่อน", "warning");
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
      const res = await fetch(isEdit ? `/api/plan/schedules/${editId}` : "/api/plan/schedules", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys, title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        PopUpAlert("บันทึกไม่สำเร็จ", data.message ?? "กรุณาลองใหม่อีกครั้ง", "error");
        return;
      }
      // Clear the new-plan draft so the next "new plan" starts empty (edit
      // mode never touches this draft).
      if (!isEdit) {
        localStorage.removeItem(STORAGE_KEY);
        setSubjects([]);
        setChosen({});
      }
      PopUpAlert(
        "บันทึกแล้ว!",
        isEdit ? "อัปเดตตารางเรียนเรียบร้อย" : "เพิ่มลงใน My Plan เป็นตารางใหม่แล้ว",
        "success",
        { imageUrl: "/save.gif" }
      );
      router.push(isEdit ? `/dashboard/plan/${editId}` : "/dashboard/plan");
      router.refresh();
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
            <p>⚠ คุณเลือกวิชาเดียวกันมากกว่า 1 section</p>
          ) : null}
          {timeSet.size > 0 ? <p>⚠ มีบางวิชาเรียนเวลาทับกัน</p> : null}
          <p className="text-xs text-red-500">section ที่ชนกันถูกไฮไลต์สีแดงในตาราง</p>
        </div>
      ) : null}

      {/* Subject list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            วิชาที่เลือก {subjects.length > 0 ? `(${subjects.length})` : ""}
          </h2>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-gray-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            เพิ่มวิชา
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            ยังไม่มีวิชา กด <span className="font-semibold text-gray-700">เพิ่มวิชา</span>{" "}
            เพื่อเลือกจากรายการแนะนำหรือค้นหาในระบบ
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
                  className={`relative rounded-2xl bg-white p-4 shadow-sm ring-1 ${
                    chosenSec ? "ring-gray-100" : "bg-amber-50/40 ring-amber-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPickerCode(code)}
                    aria-label={chosenSec ? `Change section for ${code}` : `Choose a section for ${code}`}
                    className="block w-full text-left"
                  >
                    {/* Header with accent line (header only) */}
                    <div className="flex gap-3">
                      <span
                        className="w-1 shrink-0 self-stretch rounded-full"
                        style={{ backgroundColor: chosenSec ? plannedColors.get(chosenSec.key) : "#F59E0B" }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1 pr-6">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-base font-bold text-gray-900">{code}</span>
                          {chosenSec?.section ? (
                            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Section {chosenSec.section}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs font-medium uppercase text-gray-600">
                          {course?.courseName ?? code}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {dupSet.has(chosenSec?.key ?? "") ? (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                              ซ้ำ
                            </span>
                          ) : null}
                          {timeSet.has(chosenSec?.key ?? "") ? (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                              เวลาชนกัน
                            </span>
                          ) : null}
                          {chosenSec ? (
                            <span className="text-xs font-medium text-orange-500">แตะเพื่อเปลี่ยน section</span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600">
                              ⚠ เลือก section — มี {sectionCount} section
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Day / time / building rows when a section is chosen */}
                    {chosenSec ? (
                      <div className="mt-3 pl-4">
                        <MeetingRows meetings={chosenSec.meetings} />
                      </div>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeSubject(code)}
                    aria-label={`Remove ${code}`}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm text-gray-400 hover:bg-gray-100 hover:text-red-600"
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
              {saving ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "บันทึกลง My Plan"}
            </button>
          </div>
        ) : null}
      </section>

      {/* ── Add-subject slide-up sheet ─────────────────────────────────────── */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ariaLabel="เพิ่มวิชา"
        detents={[50, 82]}
        initial={82}
        header={
          <>
            <div className="px-5 pb-3 pt-1">
              <h2 className="text-lg font-bold text-gray-900">เพิ่มวิชา</h2>
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
                  ไม่มีวิชาแนะนำ — วิชาที่ยังขาดของคุณผ่านหมดแล้วหรือไม่เปิดสอนเทอมนี้
                  ลองแท็บอื่นดู
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
                    placeholder="ค้นหาด้วยรหัสวิชาหรือชื่อวิชา…"
                    aria-label="Search subjects"
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {q && searchResults.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">ไม่พบวิชาที่ตรงกับ “{query}”</p>
                ) : null}
                {!q ? (
                  <p className="py-6 text-center text-sm text-gray-400">
                    พิมพ์เพื่อค้นหาวิชาที่ต้องการเพิ่ม
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
              <p className="mt-0.5 text-xs uppercase tracking-wide text-gray-400">เลือก section</p>
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
                        <p className="mt-0.5 text-xs text-gray-500">{dayTimeText(sec)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {seats.full ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            FULL
                          </span>
                        ) : isChosen ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            Selected
                          </span>
                        ) : null}
                        {rooms ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                            <BuildingGlyph />
                            {rooms}
                          </span>
                        ) : null}
                        {/* Seats as a plain number + icon (no bar) — rightmost */}
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
              {/^W$/i.test(grade) ? "ถอน (W)" : `เรียนซ้ำ ${grade}`}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-gray-500">{name}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {offered ? `มี ${sectionCount} section` : "ไม่เปิดสอนเทอมนี้"}
        </p>
        {prereq.length > 0 ? (
          <p className={`mt-0.5 text-xs ${prereqMet ? "text-gray-400" : "text-amber-600"}`}>
            ต้องผ่าน : {prereq.join(", ")}
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
        {added ? "เพิ่มแล้ว ✓" : blocked ? "—" : "เพิ่ม +"}
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
