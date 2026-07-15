// Resolve the logged-in student for API route handlers: session cookie →
// students row. Returns null when not logged in or the account vanished.
import { getSession } from "@/lib/serverAuth";
import { getStudentByUsername, type PlanStudent } from "@/lib/planQueries";

export async function getApiStudent(): Promise<PlanStudent | null> {
  const session = await getSession();
  if (!session) return null;
  return getStudentByUsername(session.u);
}
