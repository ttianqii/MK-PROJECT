import { NextRequest, NextResponse } from "next/server";
import { getApiStudent } from "@/lib/apiStudent";
import { deleteSchedule, updateSchedule } from "@/lib/planQueries";

export const dynamic = "force-dynamic";

async function scheduleId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Rename a schedule, toggle its ♥ (liked) flag, or replace its sections. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const student = await getApiStudent();
  if (!student) return NextResponse.json({ message: "Not logged in." }, { status: 401 });

  const id = await scheduleId(params);
  if (!id) return NextResponse.json({ message: "Invalid schedule id." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const patch: { title?: string; liked?: boolean; sectionKeys?: string[] } = {};
  if (typeof body.title === "string" && body.title.trim().length <= 100) {
    patch.title = body.title.trim();
  }
  if (typeof body.liked === "boolean") patch.liked = body.liked;
  if (
    Array.isArray(body.keys) &&
    body.keys.length > 0 &&
    body.keys.every((k: unknown) => typeof k === "string")
  ) {
    patch.sectionKeys = body.keys;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "Nothing to update." }, { status: 400 });
  }

  const ok = await updateSchedule(student.id, id, patch);
  if (!ok) return NextResponse.json({ message: "Schedule not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const student = await getApiStudent();
  if (!student) return NextResponse.json({ message: "Not logged in." }, { status: 401 });

  const id = await scheduleId(params);
  if (!id) return NextResponse.json({ message: "Invalid schedule id." }, { status: 400 });

  const ok = await deleteSchedule(student.id, id);
  if (!ok) return NextResponse.json({ message: "Schedule not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
