import { redirect } from "next/navigation";
import { getSession } from "@/lib/serverAuth";
import { getStudentByUsername } from "@/lib/planQueries";
import DashboardHeader from "@/components/DashboardHeader";

// The header (with the floating phone nav) lives in the layout so it persists
// across page navigations — that's what lets the active-tab switch animate
// instead of remounting from scratch with each page.
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await getStudentByUsername(session.u);
  if (!student) redirect("/login");

  return (
    <div className="min-h-screen bg-stone-100">
      <DashboardHeader
        student={{ studentId: student.studentId, nameEn: student.nameEn, photo: student.photo }}
      />
      {children}
    </div>
  );
}
