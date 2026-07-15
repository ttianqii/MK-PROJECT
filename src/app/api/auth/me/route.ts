import { NextResponse } from "next/server";
import { getSession } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    username: session.u,
    role: session.role,
  });
}
