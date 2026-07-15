import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { SettingsForm } from "@/components/settings-form";
import { SubpageHeader } from "@/components/subpage-header";
import { getAccountProfile } from "@/lib/dashboard";
import { getTranslator } from "@/lib/i18n-server";

export default async function SettingsPage() {
  const [profile, t] = await Promise.all([getAccountProfile(), getTranslator()]);
  if (!profile) redirect("/login?next=%2Fprofile%2Fsettings");
  return <AppFrame><SubpageHeader back="/profile" title={t("个人设置")} width="max-w-2xl" /><main className="mx-auto max-w-2xl px-5 py-8"><SettingsForm initialProfile={{ name: profile.name, phone: profile.phone, birthday: profile.birthday }} /></main></AppFrame>;
}
