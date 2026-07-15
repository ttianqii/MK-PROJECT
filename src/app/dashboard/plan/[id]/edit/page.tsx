import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getScheduleById, getStudentByUsername } from "@/lib/planQueries";
import { getSchedule } from "@/lib/scheduleQueries";
import { getChecklist } from "@/lib/checklist";
import { recommendCourses, stillNeededCourses, buildEligibility } from "@/lib/recommendations";
import { groupSections } from "@/lib/timetable";
import PlanBuilder from "@/components/PlanBuilder";

export const dynamic = "force-dynamic";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await getStudentByUsername(session.u);
  if (!student) redirect("/login");

  const { id } = await params;
  const scheduleId = Number(id);
  if (!Number.isInteger(scheduleId) || scheduleId <= 0) notFound();

  const [row, schedule, checklist] = await Promise.all([
    getScheduleById(student.id, scheduleId),
    getSchedule(),
    getChecklist(session.u),
  ]);
  if (!row) notFound();

  const sections = groupSections(schedule.slots);
  const recommendations = checklist ? recommendCourses(checklist, sections) : [];
  const needed = checklist ? stillNeededCourses(checklist, sections) : [];
  const eligibility = checklist
    ? buildEligibility(checklist)
    : { passed: [], prereqByCode: {}, checklistCodes: [] };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-8">
      <div className="mb-6">
        <Link
          href={`/dashboard/plan/${scheduleId}`}
          className="text-xs font-medium text-gray-400 hover:text-gray-600"
        >
          ‹ กลับไปหน้ารายละเอียด
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Edit Plan</h1>
        <p className="mt-1 text-sm text-gray-500">
          {schedule.campus && schedule.semester
            ? `${schedule.campus} · ${schedule.semester}`
            : "แก้ไขตารางเรียน"}{" "}
          — เพิ่ม/เปลี่ยนวิชาและ section แล้วบันทึกการแก้ไข
        </p>
      </div>

      <PlanBuilder
        data={schedule}
        recommendations={recommendations}
        needed={needed}
        eligibility={eligibility}
        editId={scheduleId}
        initialKeys={row.sectionKeys}
        initialTitle={row.title}
      />
    </main>
  );
}
