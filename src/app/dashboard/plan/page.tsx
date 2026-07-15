import { redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getSchedule } from "@/lib/scheduleQueries";
import { getChecklist } from "@/lib/checklist";
import { recommendCourses } from "@/lib/recommendations";
import { groupSections } from "@/lib/timetable";
import DashboardHeader from "@/components/DashboardHeader";
import PlanBuilder from "@/components/PlanBuilder";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const schedule = await getSchedule();

  // Cross-reference the student's Study Plan with what's offered this term.
  const checklist = await getChecklist(session.u);
  const recommendations = checklist
    ? recommendCourses(checklist, groupSections(schedule.slots))
    : [];

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader username={session.u} />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Plan next term</h1>
          <p className="mt-1 text-sm text-gray-500">
            {schedule.campus && schedule.semester
              ? `${schedule.campus} · ${schedule.semester}.`
              : "Build your weekly timetable."}{" "}
            Add class sections to lay out your week and catch time conflicts.
          </p>
        </div>

        {schedule.slots.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-gray-600">No schedule data has been loaded yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Run <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">bun run db:seed</code>{" "}
              to load the demo schedule.
            </p>
          </div>
        ) : (
          <PlanBuilder data={schedule} recommendations={recommendations} />
        )}
      </main>
    </div>
  );
}
