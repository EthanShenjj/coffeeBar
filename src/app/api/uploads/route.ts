import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "请选择图片" }, { status: 400 });
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "仅支持 5MB 以内图片" }, { status: 400 });
    }
    const blob = await put(`products/${crypto.randomUUID()}-${file.name}`, file, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "上传失败" }, { status: 403 });
  }
}
