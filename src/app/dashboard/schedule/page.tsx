import { redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getStudentByUsername } from "@/lib/planQueries";
import { getSchedule } from "@/lib/scheduleQueries";
import DashboardHeader from "@/components/DashboardHeader";
import ScheduleBrowser from "@/components/ScheduleBrowser";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await getStudentByUsername(session.u);
  if (!student) redirect("/login");

  const schedule = await getSchedule();

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader
        student={{ studentId: student.studentId, nameEn: student.nameEn, photo: student.photo }}
      />

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Class schedule</h1>
          <p className="mt-1 text-sm text-gray-500">
            {schedule.campus && schedule.semester
              ? `${schedule.campus} · ${schedule.semester}`
              : "Browse the class schedule by day."}
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
          <ScheduleBrowser data={schedule} />
        )}
      </main>
    </div>
  );
}
