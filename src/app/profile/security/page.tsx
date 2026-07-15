import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { SettingsForm } from "@/components/settings-form";
import { SubpageHeader } from "@/components/subpage-header";
import { getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n-server";

export default async function SecurityPage() {
  const [session, t] = await Promise.all([getSession(), getTranslator()]);
  if (!session) redirect("/login?next=%2Fprofile%2Fsecurity");
  return <AppFrame><SubpageHeader back="/profile" title={t("账号与密码")} width="max-w-2xl" /><main className="mx-auto max-w-2xl px-5 py-8"><SettingsForm security email={session.user.email} /></main></AppFrame>;
}
