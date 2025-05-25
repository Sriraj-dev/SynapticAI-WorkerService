import { defineConfig } from "drizzle-kit";
import "./src/config/env"

export default defineConfig({
  schema: "./src/services/Postgres/schema.ts",
  out: "./src/services/Postgres/migrations",
  dialect: "postgresql",

  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  schemaFilter:["drizzle"],
});
