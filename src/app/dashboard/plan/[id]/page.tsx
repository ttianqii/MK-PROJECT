import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getScheduleById, getStudentByUsername } from "@/lib/planQueries";
import { getSchedule } from "@/lib/scheduleQueries";
import { getChecklist } from "@/lib/checklist";
import { buildEligibility } from "@/lib/recommendations";
import { groupSections, sectionColors, type PlanSection } from "@/lib/timetable";
import TimetableGrid from "@/components/TimetableGrid";
import ScheduleCard from "@/components/ScheduleCard";
import SubjectDetailCard from "@/components/SubjectDetailCard";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await getStudentByUsername(session.u);
  if (!student) redirect("/login");

  const { id } = await params;
  const scheduleId = Number(id);
  if (!Number.isInteger(scheduleId) || scheduleId <= 0) notFound();

  const [row, scheduleData, checklist] = await Promise.all([
    getScheduleById(student.id, scheduleId),
    getSchedule(),
    getChecklist(session.u),
  ]);
  if (!row) notFound();

  const byKey = new Map(groupSections(scheduleData.slots).map((s) => [s.key, s]));
  const sections: PlanSection[] = row.sectionKeys
    .map((k) => byKey.get(k))
    .filter((x): x is PlanSection => Boolean(x));
  const colors = sectionColors(sections);
  const elig = checklist
    ? buildEligibility(checklist)
    : { passed: [], prereqByCode: {}, checklistCodes: [] };
  const title = row.title || "Schedule";
  const totalCredits = sections.length;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/plan" className="text-xs font-medium text-gray-400 hover:text-gray-600">
            ‹ กลับไป My Plan
          </Link>
          <h1 className="text-3xl font-light uppercase tracking-wide text-gray-900">Plan Detail</h1>
          <p className="mt-1 text-sm text-gray-500">
            {title}
            {scheduleData.semester ? ` · ${scheduleData.semester}` : ""} · {totalCredits} วิชา
          </p>
        </div>
        <Link
          href={`/dashboard/plan/${scheduleId}/edit`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-gray-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
          แก้ไข
        </Link>
      </div>

      {sections.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-600">วิชาในตารางนี้ไม่ได้เปิดสอนในเทอมนี้แล้ว</p>
        </div>
      ) : (
        <>
          <ScheduleCard className="mt-6">
            <h2 className="mb-2 text-xl font-bold uppercase tracking-wide text-gray-800">ตารางเรียน</h2>
            <TimetableGrid sections={sections} />
          </ScheduleCard>

          <div className="mt-6 space-y-4">
            {sections.map((s) => (
              <SubjectDetailCard
                key={s.key}
                section={s}
                color={colors.get(s.key) ?? "#7A8290"}
                prereq={elig.prereqByCode[s.courseCode.toUpperCase()] ?? []}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
