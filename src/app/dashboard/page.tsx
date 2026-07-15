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
    <div className="min-h-screen bg-stone-100">
      <DashboardHeader
        student={{ studentId: student.studentId, nameEn: student.nameEn, photo: student.photo }}
      />

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8 md:pb-8">
        {!checklist ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
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
    <div className="space-y-5 sm:space-y-6">
      {/* Page title */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Overview</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          Study Info
        </h1>
      </div>

      {/* Student profile card — blurred image cover inset from the card edges,
          avatar overlapping it */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="px-2.5 pt-2.5 sm:px-3 sm:pt-3">
          <div className="relative h-24 overflow-hidden rounded-2xl sm:h-32" aria-hidden="true">
            {/* Scaled up so the blur doesn't reveal transparent edges */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/wavy-black-white-background.jpg"
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm"
            />
          </div>
        </div>
        {/* relative + z-10 keeps the avatar painting above the cover's
            absolutely-positioned image where they overlap */}
        <div className="relative z-10 px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-8 flex items-end justify-between gap-4 sm:-mt-10">
            <div className="ml-4 sm:ml-8">
              {student.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={student.photo}
                  alt={student.nameEn || student.nameTh}
                  className="h-16 w-16 shrink-0 rounded-full object-cover shadow-md ring-4 ring-white sm:h-20 sm:w-20"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 shadow-md ring-4 ring-white sm:h-20 sm:w-20">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-gray-400">
                    <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z" />
                  </svg>
                </span>
              )}
            </div>
            {/* GPA badge, top right of the profile section */}
            <span className="mb-1 flex items-baseline gap-1.5 rounded-full bg-gray-900 px-3.5 py-1.5 text-white shadow-md">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">GPA</span>
              <span className="text-sm font-bold">{student.gpa || "—"}</span>
            </span>
          </div>

          <h2 className="mt-3 truncate text-lg font-semibold text-gray-900 sm:text-2xl">
            {student.nameTh}
          </h2>
          {student.nameEn ? (
            <p className="truncate text-sm text-gray-500">{student.nameEn}</p>
          ) : null}
          {/* Student id, under the name */}
          <p className="mt-1 font-mono text-sm text-gray-500">{student.studentId}</p>

          {/* Overall progress — sits above the details list */}
          <div className="mt-5 rounded-2xl bg-gray-50 p-4">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-gray-800">Credits earned</span>
              <span className="text-gray-500">
                <span className="font-semibold text-gray-900">{earned}</span> / {total}
                <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {pct}%
                </span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200/80">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Academic details — plain registrar-style table: label left,
              value right, no box around it. */}
          <dl className="mt-5 grid grid-cols-1 gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
            {student.info
              .filter((item) => !HIDDEN_INFO.includes(item.label))
              .map((item, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-gray-500">{item.label}</dt>
                <dd className="text-right font-semibold text-gray-900">{item.value || "—"}</dd>
              </div>
            ))}
          </dl>

        </div>
      </section>

      {/* Categories + course search */}
      <ChecklistCategories categories={categories} />
    </div>
  );
}
