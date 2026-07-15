import { NextRequest, NextResponse } from "next/server";
import { authenticate, loginWithBu } from "@/lib/checklist";
import { signSession, isHttpsRequest, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Redirect with a relative Location header. NextResponse.redirect() requires
 * an absolute URL built from request.url, but behind Docker (or any proxy)
 * request.url reflects the server's bind address (e.g. http://0.0.0.0:3000),
 * which sends phones on the LAN to an unreachable host. Browsers resolve a
 * relative Location against the origin they actually used, which is always
 * right.
 */
function redirectTo(path: string, status: 303 = 303) {
  return new NextResponse(null, { status, headers: { Location: path } });
}

/**
 * Accepts both the JS fetch() flow (JSON body, JSON response) and a plain
 * HTML <form method="post"> submission (form-encoded body) — the login page
 * sets both `action`/`method` on the form AND a JS handler, so this still
 * works as a real login if JavaScript hasn't hydrated yet on the client
 * (which is exactly what a bare `GET /login?` in the server log means: the
 * browser fell back to a native submit because no JS ever intercepted it).
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded");

  try {
    let username: unknown;
    let password: unknown;
    let mode: unknown;
    if (isFormPost) {
      const form = await request.formData();
      username = form.get("username");
      password = form.get("password");
      mode = form.get("mode");
    } else {
      ({ username, password, mode } = await request.json());
    }

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      if (isFormPost) {
        return redirectTo("/login?error=missing");
      }
      return NextResponse.json({ message: "Username and password are required." }, { status: 400 });
    }

    // "bu" authenticates live against the real Bangkok University checklist
    // system and mirrors the result into the local DB; anything else falls
    // back to the local demo-account check (unchanged behavior).
    const result =
      mode === "bu"
        ? await loginWithBu(username.trim(), password)
        : await authenticate(username.trim(), password);

    if (!result.ok) {
      if (isFormPost) {
        return redirectTo("/login?error=invalid");
      }
      return NextResponse.json({ message: result.message || "Invalid username or password." }, { status: 401 });
    }

    const token = await signSession(username.trim());
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: isHttpsRequest(request),
      path: "/",
      maxAge: SESSION_MAX_AGE,
    };

    if (isFormPost) {
      const response = redirectTo("/dashboard");
      response.cookies.set(SESSION_COOKIE, token, cookieOptions);
      return response;
    }

    const response = NextResponse.json({ ok: true, role: "student", redirectTo: "/dashboard" });
    response.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    if (isFormPost) {
      return redirectTo("/login?error=failed");
    }
    return NextResponse.json({ message: "Login failed. Please try again." }, { status: 500 });
  }
}
