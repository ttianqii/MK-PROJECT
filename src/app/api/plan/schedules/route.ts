import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/apiStudent";
import { addSchedule } from "@/lib/planQueries";

export const dynamic = "force-dynamic";

/** Save the builder's current selection as a new schedule in the plan. */
export async function POST(request: NextRequest) {
  const student = await getApiStudent();
  if (!student) return NextResponse.json({ message: "Not logged in." }, { status: 401 });

  const { keys } = await request.json().catch(() => ({}));
  if (!Array.isArray(keys) || keys.length === 0 || !keys.every((k) => typeof k === "string")) {
    return NextResponse.json({ message: "Add at least one class before saving." }, { status: 400 });
  }

  const row = await addSchedule(student.id, keys);
  return NextResponse.json({ ok: true, id: row.id });
}
