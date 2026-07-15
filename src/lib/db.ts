import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

let prisma: PrismaClient | undefined;

export function hasDatabase() {
  return process.env.COFFEEBAR_DEMO_MODE !== "true" && Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 未配置");
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}
