import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required to run migrations.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 10_000,
});

const db = drizzle({ client: pool });

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("PostgreSQL migrations applied successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
