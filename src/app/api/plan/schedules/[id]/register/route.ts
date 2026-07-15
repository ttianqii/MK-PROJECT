import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/apiStudent";
import { registerSchedule } from "@/lib/planQueries";
import { getSchedule } from "@/lib/scheduleQueries";

export const dynamic = "force-dynamic";

/** REGISTER button: snapshot this schedule as the student's registration. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const student = await getApiStudent();
  if (!student) return NextResponse.json({ message: "Not logged in." }, { status: 401 });

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid schedule id." }, { status: 400 });
  }

  const { semester } = await getSchedule();
  if (!semester) {
    return NextResponse.json({ message: "No term is open for registration." }, { status: 409 });
  }

  const ok = await registerSchedule(student.id, id, semester);
  if (!ok) return NextResponse.json({ message: "Schedule not found." }, { status: 404 });
  return NextResponse.json({ ok: true, redirectTo: "/dashboard/registration" });
}
