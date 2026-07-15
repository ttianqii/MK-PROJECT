// Server-side helper (Node runtime) for reading the logged-in session inside
// route handlers and server components.
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, type SessionPayload } from "./session";

/** Read and verify the session from the request cookies. Returns null if absent/invalid. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}
