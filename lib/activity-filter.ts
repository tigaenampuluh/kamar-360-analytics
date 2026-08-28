import { and, eq, ilike, or, type SQL } from "drizzle-orm";
import { activityLogs } from "@/db/schema";

/**
 * Activity visible to the whole workspace. Account, invitation, and password
 * administration are intentionally excluded from the collaboration timeline.
 */
export function workActivityCondition(): SQL {
  return or(
    ilike(activityLogs.action, "%project%"),
    ilike(activityLogs.action, "%agenda%"),
    ilike(activityLogs.action, "%asset%"),
    ilike(activityLogs.action, "%catatan%"),
    ilike(activityLogs.action, "%deadline%"),
    ilike(activityLogs.action, "%backup%"),
  )!;
}

/** Milestone project yang aman dan relevan untuk seluruh anggota workspace. */
export function memberProjectMilestoneCondition(): SQL {
  return or(
    eq(activityLogs.action, "membuat project"),
    ilike(activityLogs.action, "%menyelesaikan project%"),
    and(eq(activityLogs.action, "memindahkan project"), or(
      ilike(activityLogs.details, "%→ Done%"),
      ilike(activityLogs.details, "%→ Revisi%"),
    )),
  )!;
}

export function memberActivityLabel(action: string, details: string) {
  if (action === "membuat project") return "menambahkan project";
  if (action.toLowerCase().includes("menyelesaikan") || details.includes("→ Done")) return "menyelesaikan project";
  return "mengirim project untuk revisi";
}
