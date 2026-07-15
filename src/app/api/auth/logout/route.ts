import { NextRequest, NextResponse } from "next/server";
import { isHttpsRequest, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    // Must match how the cookie was set at login (see isHttpsRequest) or the
    // browser refuses the overwrite and the session survives "logout".
    secure: isHttpsRequest(request),
    path: "/",
    maxAge: 0,
  });
  return response;
}
