import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getRegistration, getStudentByUsername } from "@/lib/planQueries";
import { getSchedule } from "@/lib/scheduleQueries";
import {
  DAYS,
  formatMinutes,
  groupSections,
  sectionColors,
  type PlanSection,
} from "@/lib/timetable";
import DashboardHeader from "@/components/DashboardHeader";
import TimetableGrid from "@/components/TimetableGrid";
import ScheduleCard from "@/components/ScheduleCard";

export const dynamic = "force-dynamic";

const DAY_SHORT = new Map(DAYS.map((d) => [d.full, d.short]));

/** Date -> "9/5/23 15:39" (matches the reference header). */
function formatUpdated(d: Date): string {
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1}/${yy} ${hh}:${mm}`;
}

export default async function RegistrationResultPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await getStudentByUsername(session.u);
  if (!student) redirect("/login");

  const scheduleData = await getSchedule();
  const registration = scheduleData.semester
    ? await getRegistration(student.id, scheduleData.semester)
    : null;

  const byKey = new Map(groupSections(scheduleData.slots).map((s) => [s.key, s]));
  const sections: PlanSection[] = (registration?.sectionKeys ?? [])
    .map((k) => byKey.get(k))
    .filter((x): x is PlanSection => Boolean(x));
  const colors = sectionColors(sections);

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader
        student={{ studentId: student.studentId, nameEn: student.nameEn, photo: student.photo }}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-light uppercase tracking-wide text-gray-900">
            Registration Result
          </h1>
          {scheduleData.semester ? (
            <span className="rounded-full bg-gray-200 px-4 py-1.5 text-lg font-semibold text-gray-800">
              {scheduleData.semester}
            </span>
          ) : null}
        </div>
        {registration ? (
          <p className="mt-1 text-sm uppercase tracking-wide text-gray-400">
            Updated at {formatUpdated(registration.registeredAt)} hrs.
          </p>
        ) : null}

        {!registration ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">You haven&apos;t registered a schedule yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Save a schedule in{" "}
              <Link href="/dashboard/plan" className="font-medium text-blue-600 hover:underline">
                My Plan
              </Link>{" "}
              and press REGISTER.
            </p>
          </div>
        ) : (
          <>
            {/* Weekly grid */}
            <ScheduleCard className="mt-6">
              <h2 className="mb-2 text-xl font-bold uppercase tracking-wide text-gray-800">
                Schedule
              </h2>
              <TimetableGrid sections={sections} />
            </ScheduleCard>

            {/* One card per registered course section */}
            <div className="mt-6 space-y-4">
              {sections.map((s) => (
                <ScheduleCard key={s.key} className="relative overflow-hidden">
                  <span
                    className="absolute left-0 top-4 bottom-4 w-1.5 rounded-r"
                    style={{ backgroundColor: colors.get(s.key) }}
                    aria-hidden="true"
                  />
                  <div className="pl-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-lg font-bold text-gray-900">{s.courseCode}</p>
                      {s.section ? (
                        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                          Section {s.section}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium uppercase text-gray-700">{s.courseName}</p>

                    <dl className="mt-4 space-y-4">
                      {s.meetings.map((m, i) => (
                        <div key={i} className="flex gap-6">
                          <dt className="w-12 shrink-0 pt-0.5 text-sm font-bold uppercase text-gray-800">
                            {DAY_SHORT.get(m.day) ?? m.day}
                          </dt>
                          <dd className="min-w-0">
                            <p className="text-base text-gray-800">
                              {formatMinutes(m.startMin)} - {formatMinutes(m.endMin)}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M12 2a7 7 0 00-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z" />
                              </svg>
                              {m.room || "Room not specified"}
                            </p>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </ScheduleCard>
              ))}
            </div>

            {/* Payment footer (static in this demo) */}
            <section className="mt-8 border-t border-gray-200 pt-5 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Payment status :{" "}
                <span className="text-gray-400">Not available</span>
              </p>
              <button
                type="button"
                disabled
                className="mt-3 w-full max-w-md cursor-not-allowed rounded-full bg-gray-300 py-3 text-lg font-semibold uppercase tracking-wide text-white"
              >
                Display Tuition
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
