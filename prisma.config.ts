import { defineConfig } from "prisma/config";

// Next.js keeps local development secrets in `.env.local`, while Prisma only
// loads `.env` by default. Load the same file Next.js uses so CLI migrations
// cannot silently fall back to an unrelated local database.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Vercel/CI provides environment variables directly, so the file is optional.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgresql://coffeebar:coffeebar@127.0.0.1:5432/coffeebar",
  },
});
