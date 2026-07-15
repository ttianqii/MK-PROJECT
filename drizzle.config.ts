import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Matches the MariaDB service in compose.yaml; override with DATABASE_URL.
    url: process.env.DATABASE_URL ?? "mysql://mk:mkpassword@127.0.0.1:3306/mkproject",
  },
});
