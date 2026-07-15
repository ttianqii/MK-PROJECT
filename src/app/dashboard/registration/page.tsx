import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getRegistration, getStudentByUsername } from "@/lib/planQueries";
import { getSchedule } from "@/lib/scheduleQueries";
import { groupSections, sectionColors, type PlanSection } from "@/lib/timetable";
import TimetableGrid from "@/components/TimetableGrid";
import ScheduleCard from "@/components/ScheduleCard";
import SubjectDetailCard from "@/components/SubjectDetailCard";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-8">
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
          <p className="mt-1 text-sm text-gray-400">
            อัปเดตเมื่อ {formatUpdated(registration.registeredAt)} น.
          </p>
        ) : null}

        {!registration ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">คุณยังไม่ได้ลงทะเบียนตารางเรียน</p>
            <p className="mt-1 text-sm text-gray-400">
              บันทึกตารางใน{" "}
              <Link href="/dashboard/plan" className="font-medium text-blue-600 hover:underline">
                My Plan
              </Link>{" "}
              แล้วกดปุ่มลงทะเบียนเรียน
            </p>
          </div>
        ) : (
          <>
            {/* Weekly grid */}
            <ScheduleCard className="mt-6">
              <h2 className="mb-2 text-xl font-bold uppercase tracking-wide text-gray-800">
                ตารางเรียน
              </h2>
              <TimetableGrid sections={sections} />
            </ScheduleCard>

            {/* One card per registered course section */}
            <div className="mt-6 space-y-4">
              {sections.map((s) => (
                <SubjectDetailCard key={s.key} section={s} color={colors.get(s.key) ?? "#7A8290"} />
              ))}
            </div>

            {/* Payment footer (static in this demo) */}
            <section className="mt-8 border-t border-gray-200 pt-5 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                สถานะการชำระเงิน : <span className="text-gray-400">ไม่พร้อมใช้งาน</span>
              </p>
              <button
                type="button"
                disabled
                className="mt-3 w-full max-w-md cursor-not-allowed rounded-full bg-gray-300 py-3 text-lg font-semibold uppercase tracking-wide text-white"
              >
                แสดงค่าเทอม
              </button>
            </section>
          </>
        )}
    </main>
  );
}
