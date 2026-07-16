// The localStorage key + helpers for the plan builder's "new plan" draft.
// Kept in one place so both the builder (which reads/writes it) and the
// "เพิ่มตาราง" entry point (which clears it for a fresh start) agree on it.
export const PLAN_DRAFT_KEY = "sp:nextTermPlan";

export function clearPlanDraft(): void {
  try {
    localStorage.removeItem(PLAN_DRAFT_KEY);
  } catch {
    /* localStorage unavailable — nothing to clear */
  }
}
