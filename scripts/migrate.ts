import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../db";

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
