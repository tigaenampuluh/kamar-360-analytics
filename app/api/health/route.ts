import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  await db.execute(sql`select 1`);
  return Response.json({ status: "ok", service: "ruang-riset-api", timestamp: new Date().toISOString() });
}
