"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { markAnnouncementReadForUser } from "@/server/services/announcements";
import { updateProfileForUser } from "@/server/services/profiles";

const birthdaySchema = z.string().refine((value) => {
  if (value === "") return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "生日格式有误");
const profileSchema = z.object({ name: z.string().trim().min(2).max(40), phone: z.string().regex(/^1\d{10}$/).or(z.literal("")), birthday: birthdaySchema.optional() });

export async function updateProfile(raw: unknown) {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "资料格式有误" };
  if (!hasDatabase()) return { ok: true, message: "演示模式：资料已在界面预览" };
  try {
    const user = await requireUser();
    await updateProfileForUser(user.id, parsed.data);
    revalidatePath("/profile");
    return { ok: true, message: "个人资料已更新" };
  } catch { return { ok: false, message: "保存失败" }; }
}

export async function markMessageRead(id: string) {
  if (!hasDatabase()) return { ok: true };
  const user = await requireUser();
  await markAnnouncementReadForUser(user.id, id);
  revalidatePath("/messages");
  return { ok: true };
}
