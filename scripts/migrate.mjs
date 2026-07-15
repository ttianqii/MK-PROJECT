// Apply Drizzle migrations to the MariaDB database.
//
//   DATABASE_URL=mysql://user:pass@host:3306/db node scripts/migrate.mjs
//
// Reads the compiled migrations from ./drizzle. Idempotent: drizzle tracks
// applied migrations in the database. Retries the initial connection so it can
// run as a container entrypoint while MariaDB is still starting up.
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const url = process.env.DATABASE_URL ?? "mysql://mk:mkpassword@127.0.0.1:3306/mkproject";

const MAX_ATTEMPTS = 30;
let connection;
for (let attempt = 1; ; attempt++) {
  try {
    connection = await mysql.createConnection(url);
    break;
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) throw err;
    console.log(`Database not ready (${err.code ?? err.message}); retry ${attempt}/${MAX_ATTEMPTS}…`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

await migrate(drizzle(connection), { migrationsFolder: "./drizzle" });
await connection.end();

console.log(`Migrations applied to ${url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@")}`);
