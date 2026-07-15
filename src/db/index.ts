import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// MariaDB connection via mysql2. compose.yaml provides the matching service;
// override with DATABASE_URL for any other MySQL-compatible database.
const url = process.env.DATABASE_URL ?? "mysql://mk:mkpassword@127.0.0.1:3306/mkproject";

// Reuse one pool across dev hot-reloads so recompiles don't leak connections.
const globalForDb = globalThis as unknown as { mkPool?: mysql.Pool };

const pool =
  globalForDb.mkPool ??
  mysql.createPool({ uri: url, connectionLimit: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.mkPool = pool;

export const db = drizzle(pool, { schema, mode: "default" });

export { schema };
