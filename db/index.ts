import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:55432/ruang_riset";
const globalForDatabase = globalThis as unknown as { postgresPool?: Pool };

export const pool = globalForDatabase.postgresPool ?? new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

if (process.env.NODE_ENV !== "production") globalForDatabase.postgresPool = pool;

export const db = drizzle({ client: pool, schema });
