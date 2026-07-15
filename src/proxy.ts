import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// Gate the signed-in area. The landing page (`/`) and `/login` stay public.
export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (session) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // The proxy runtime requires an absolute redirect URL, but request.url
  // reflects the server's bind address (http://0.0.0.0:3000 in Docker), which
  // is unreachable from other devices. Rebuild the origin from the Host
  // header the client actually used instead.
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
