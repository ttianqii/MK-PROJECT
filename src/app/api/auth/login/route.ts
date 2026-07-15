import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/checklist";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return NextResponse.json({ message: "Username and password are required." }, { status: 400 });
    }

    const result = await authenticate(username.trim(), password);

    if (!result.ok) {
      return NextResponse.json({ message: result.message || "Invalid username or password." }, { status: 401 });
    }

    const token = await signSession(username.trim());

    const response = NextResponse.json({ ok: true, role: "student", redirectTo: "/dashboard" });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Login failed. Please try again." }, { status: 500 });
  }
}
