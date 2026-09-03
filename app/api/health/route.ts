import { sql } from "drizzle-orm";
import { db } from "@/db";
import { APP_ID, APP_NAME, APP_SERVICE } from "@/lib/app-identity";
import packageInfo from "@/package.json";

export const runtime = "nodejs";

export async function GET() {
  await db.execute(sql`select 1`);
  return Response.json({
    status: "ok",
    appId: APP_ID,
    appName: APP_NAME,
    service: APP_SERVICE,
    version: packageInfo.version,
    timestamp: new Date().toISOString(),
  });
}
