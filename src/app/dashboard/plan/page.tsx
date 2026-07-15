import { redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getOrCreatePlan, getStudentByUsername } from "@/lib/planQueries";
import { getSchedule } from "@/lib/scheduleQueries";
import { groupSections, type PlanSection } from "@/lib/timetable";
import PlanView, { type PlanViewSchedule } from "@/components/PlanView";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await getStudentByUsername(session.u);
  if (!student) redirect("/login");

  const [{ plan, schedules }, scheduleData] = await Promise.all([
    getOrCreatePlan(student.id),
    getSchedule(),
  ]);

  // Resolve each schedule's stored section keys against this term's offering.
  const byKey = new Map(groupSections(scheduleData.slots).map((s) => [s.key, s]));
  const resolved: PlanViewSchedule[] = schedules.map((s) => ({
    id: s.id,
    title: s.title,
    liked: s.liked,
    sections: s.sectionKeys
      .map((k) => byKey.get(k))
      .filter((x): x is PlanSection => Boolean(x)),
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-8">
      <PlanView updatedAt={plan.updatedAt.toISOString()} schedules={resolved} />
    </main>
  );
}
