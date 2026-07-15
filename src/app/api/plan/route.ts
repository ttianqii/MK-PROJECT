import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/apiStudent";
import { renamePlan } from "@/lib/planQueries";

export const dynamic = "force-dynamic";

/** Rename the plan (the pencil next to "Plan 1"). */
export async function PATCH(request: NextRequest) {
  const student = await getApiStudent();
  if (!student) return NextResponse.json({ message: "Not logged in." }, { status: 401 });

  const { name } = await request.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return NextResponse.json({ message: "Plan name is required (max 100 chars)." }, { status: 400 });
  }

  await renamePlan(student.id, name.trim());
  return NextResponse.json({ ok: true });
}
