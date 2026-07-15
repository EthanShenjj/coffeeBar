"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, hasDatabase } from "@/lib/db";

const profileSchema = z.object({ name: z.string().trim().min(2).max(40), phone: z.string().regex(/^1\d{10}$/).or(z.literal("")), birthday: z.string().optional() });

export async function updateProfile(raw: unknown) {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "资料格式有误" };
  if (!hasDatabase()) return { ok: true, message: "演示模式：资料已在界面预览" };
  try {
    const user = await requireUser();
    await getDb().user.update({ where: { id: user.id }, data: { name: parsed.data.name, profile: { upsert: { create: { phone: parsed.data.phone || null, birthday: parsed.data.birthday ? new Date(parsed.data.birthday) : null }, update: { phone: parsed.data.phone || null, birthday: parsed.data.birthday ? new Date(parsed.data.birthday) : null } } } } });
    revalidatePath("/profile");
    return { ok: true, message: "个人资料已更新" };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "保存失败" }; }
}

export async function markMessageRead(id: string) {
  if (!hasDatabase()) return { ok: true };
  const user = await requireUser();
  await getDb().messageReceipt.upsert({ where: { userId_announcementId: { userId: user.id, announcementId: id } }, create: { userId: user.id, announcementId: id }, update: { readAt: new Date() } });
  revalidatePath("/messages");
  return { ok: true };
}
