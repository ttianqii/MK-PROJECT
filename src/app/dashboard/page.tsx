import { redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getChecklist, type Checklist } from "@/lib/checklist";
import { getStudentByUsername } from "@/lib/planQueries";
import DashboardHeader from "@/components/DashboardHeader";
import ChecklistCategories from "@/components/ChecklistCategories";

// Redundant with the GPA badge and the credits-earned progress bar above.
const HIDDEN_INFO = ["เกรดเฉลี่ยสะสม", "หน่วยกิตสำเร็จการศึกษาของหลักสูตร", "หน่วยกิตที่เรียนได้"];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await getStudentByUsername(session.u);
  if (!student) redirect("/login");

  const checklist = await getChecklist(session.u);

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader
        student={{ studentId: student.studentId, nameEn: student.nameEn, photo: student.photo }}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {!checklist ? (
          <div className="rounded-md bg-white p-8 text-center shadow">
            <p className="text-gray-700">We couldn&apos;t load your study plan right now.</p>
            <a href="/login" className="mt-4 inline-block text-blue-600 hover:underline">
              Sign in again
            </a>
          </div>
        ) : (
          <ChecklistView checklist={checklist} />
        )}
      </main>
    </div>
  );
}

function ChecklistView({ checklist }: { checklist: Checklist }) {
  const { student, categories } = checklist;
  const earned = Number(student.creditsEarned) || 0;
  const total = Number(student.totalCredits) || 0;
  const pct = total > 0 ? Math.min(100, Math.round((earned / total) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Student card */}
      <section className="overflow-hidden rounded-lg bg-white shadow">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            {student.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={student.photo}
                alt={student.nameEn || student.nameTh}
                className="h-16 w-16 shrink-0 rounded-full border border-gray-200 object-cover sm:h-24 sm:w-24"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">{student.nameTh}</h2>
              {student.nameEn ? <p className="truncate text-sm text-gray-500">{student.nameEn}</p> : null}
              <p className="mt-1 font-mono text-sm text-gray-500">{student.studentId}</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2 border-t border-gray-100 pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
            <p className="text-3xl font-bold text-blue-600">{student.gpa || "—"}</p>
            <p className="text-xs uppercase tracking-wide text-gray-400">GPA</p>
          </div>
        </div>

        {/* Overall progress */}
        <div className="border-t border-gray-100 px-4 py-4 sm:px-6">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Credits earned</span>
            <span className="text-gray-500">
              {earned} / {total}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Info grid */}
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-gray-100 px-4 py-4 text-sm sm:grid-cols-2 sm:px-6">
          {student.info
            .filter((item) => !HIDDEN_INFO.includes(item.label))
            .map((item, i) => (
            <div key={i} className="flex justify-between gap-4">
              <dt className="text-gray-500">{item.label}</dt>
              <dd className="text-right font-medium text-gray-800">{item.value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Categories + course search */}
      <ChecklistCategories categories={categories} />
    </div>
  );
}
