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

// Info entries surfaced as chips on the hero (and therefore dropped from the
// detail grid below it).
const CHIP_INFO = ["ชั้นปี", "สถานภาพนักศึกษา"];

function ChecklistView({ checklist }: { checklist: Checklist }) {
  const { student, categories } = checklist;
  const earned = Number(student.creditsEarned) || 0;
  const total = Number(student.totalCredits) || 0;
  const pct = total > 0 ? Math.min(100, Math.round((earned / total) * 100)) : 0;

  const year = student.info.find((i) => i.label === "ชั้นปี")?.value;
  const status = student.info.find((i) => i.label === "สถานภาพนักศึกษา")?.value;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page title */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Overview</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          Study Info
        </h1>
      </div>

      {/* Student profile card — decorative cover with the avatar overlapping it */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div
          className="h-24 sm:h-32"
          style={{
            background:
              "radial-gradient(90% 160% at 85% 0%, #d9d4f0 0%, rgba(217,212,240,0) 55%)," +
              "radial-gradient(70% 130% at 12% 100%, #d7dbe0 0%, rgba(215,219,224,0) 60%)," +
              "linear-gradient(120deg, #f3f3f5 0%, #e9e9ee 55%, #e0e0e8 100%)",
          }}
          aria-hidden="true"
        />
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-8 flex items-end justify-between gap-4 sm:-mt-10">
            {student.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={student.photo}
                alt={student.nameEn || student.nameTh}
                className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-md ring-4 ring-white sm:h-20 sm:w-20"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-100 shadow-md ring-4 ring-white sm:h-20 sm:w-20">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-gray-400">
                  <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z" />
                </svg>
              </span>
            )}
            <div className="pb-0.5 text-right">
              <p className="text-3xl font-bold leading-none tracking-tight text-gray-900 sm:text-4xl">
                {student.gpa || "—"}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">GPA</p>
            </div>
          </div>

          <h2 className="mt-3 truncate text-lg font-semibold text-gray-900 sm:text-2xl">
            {student.nameTh}
          </h2>
          {student.nameEn ? (
            <p className="truncate text-sm text-gray-500">{student.nameEn}</p>
          ) : null}

          {/* Meta chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-mono text-xs font-medium text-gray-700">
              {student.studentId}
            </span>
            {year ? (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                ชั้นปี {year}
              </span>
            ) : null}
            {status ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {status}
              </span>
            ) : null}
          </div>

          {/* Overall progress */}
          <div className="mt-5 rounded-2xl bg-gray-50 p-4">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-gray-800">Credits earned</span>
              <span className="text-gray-500">
                <span className="font-semibold text-gray-900">{earned}</span> / {total}
                <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                  {pct}%
                </span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200/80">
              <div
                className="h-full rounded-full bg-gray-900 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Info grid */}
          <dl className="mt-4 grid grid-cols-1 gap-x-10 gap-y-2.5 text-sm sm:grid-cols-2">
            {student.info
              .filter((item) => !HIDDEN_INFO.includes(item.label) && !CHIP_INFO.includes(item.label))
              .map((item, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-gray-500">{item.label}</dt>
                <dd className="text-right font-medium text-gray-800">{item.value || "—"}</dd>
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
