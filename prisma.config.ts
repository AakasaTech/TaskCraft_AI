import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local for Next.js secrets
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/taskcraft?sslmode=require",
  },
});
