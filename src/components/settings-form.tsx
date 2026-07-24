"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { authClient } from "@/lib/auth-client";
import { resetAnalyticsIdentity } from "@/lib/analytics";

type ProfileValues = { name: string; phone: string; birthday: string };

export function SettingsForm({
  initialProfile,
  email,
  security = false,
}: {
  initialProfile?: ProfileValues;
  email?: string;
  security?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [profile, setProfile] = useState<ProfileValues>(initialProfile ?? { name: "", phone: "", birthday: "" });
  const [nextEmail, setNextEmail] = useState(email ?? "");
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await updateProfile(profile);
    if (result.ok) {
      await authClient.updateUser({ name: profile.name });
      toast.success(t(result.message));
      router.refresh();
    } else toast.error(t(result.message));
    setPending(false);
  }

  async function saveEmail(event: React.FormEvent) {
    event.preventDefault();
    if (nextEmail === email) return toast.info(t("邮箱没有变化"));
    setPending(true);
    const result = await authClient.changeEmail({ newEmail: nextEmail, callbackURL: "/profile/security" });
    setPending(false);
    if (result.error) return toast.error(result.error.message ?? t("邮箱修改失败"));
    toast.success(t("邮箱修改请求已提交"));
    router.refresh();
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await authClient.changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword, revokeOtherSessions: true });
    setPending(false);
    if (result.error) return toast.error(result.error.message ?? t("密码修改失败"));
    toast.success(t("密码已更新，其他设备已退出"));
    setPassword({ currentPassword: "", newPassword: "" });
  }

  async function revokeOtherSessions() {
    setPending(true);
    const result = await authClient.revokeOtherSessions();
    setPending(false);
    if (result.error) return toast.error(result.error.message ?? t("会话撤销失败"));
    toast.success(t("其他设备已退出登录"));
  }

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    resetAnalyticsIdentity();
    router.push("/login");
    router.refresh();
  }

  if (security) return <div className="space-y-5">
    <form onSubmit={saveEmail} className="space-y-4 rounded-[1.5rem] border bg-white p-6">
      <div><p className="text-xs uppercase tracking-[.18em] text-zinc-400">Email</p><h2 className="mt-2 text-xl font-semibold">{t("登录邮箱")}</h2></div>
      <p className="text-sm leading-6 text-zinc-500">{t("修改后可能需要完成邮箱验证，订单和会员数据不会改变。")}</p>
      <label className="block text-sm"><span className="mb-2 block text-zinc-500">{t("邮箱地址")}</span><Input type="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} autoComplete="email" required /></label>
      <Button type="submit" variant="outline" disabled={pending}>{t("更新邮箱")}</Button>
    </form>
    <form onSubmit={savePassword} className="space-y-4 rounded-[1.5rem] border bg-white p-6">
      <div><p className="text-xs uppercase tracking-[.18em] text-zinc-400">Password</p><h2 className="mt-2 text-xl font-semibold">{t("修改密码")}</h2></div>
      <p className="text-sm leading-6 text-zinc-500">{t("新密码至少 8 位。保存后会撤销其他设备的登录状态。")}</p>
      <label className="block text-sm"><span className="mb-2 block text-zinc-500">{t("当前密码")}</span><Input type="password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} autoComplete="current-password" required /></label>
      <label className="block text-sm"><span className="mb-2 block text-zinc-500">{t("新密码")}</span><Input type="password" minLength={8} value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} autoComplete="new-password" required /></label>
      <Button type="submit" disabled={pending}>{pending ? t("保存中…") : t("保存新密码")}</Button>
    </form>
    <section className="rounded-[1.5rem] border bg-white p-6">
      <div className="flex items-start gap-3"><MonitorSmartphone className="mt-0.5 size-5" /><div><h2 className="font-semibold">{t("登录设备")}</h2><p className="mt-1 text-sm leading-6 text-zinc-500">{t("保留当前设备，撤销其他浏览器和设备上的登录状态。")}</p></div></div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Button type="button" variant="outline" onClick={revokeOtherSessions} disabled={pending}>{t("退出其他设备")}</Button><Button type="button" variant="destructive" onClick={signOut} disabled={pending}><LogOut className="size-4" />{t("退出当前账号")}</Button></div>
    </section>
  </div>;

  return <form onSubmit={saveProfile} className="space-y-4 rounded-[1.5rem] border bg-white p-6">
    <div><p className="text-xs uppercase tracking-[.18em] text-zinc-400">Profile</p><h2 className="mt-2 text-xl font-semibold">{t("基本信息")}</h2></div>
    <label className="block text-sm"><span className="mb-2 block text-zinc-500">{t("昵称")}</span><Input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} autoComplete="name" required /></label>
    <label className="block text-sm"><span className="mb-2 block text-zinc-500">{t("手机号")}</span><Input inputMode="numeric" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} autoComplete="tel" placeholder={t("用于门店取货")} /></label>
    <label className="block text-sm"><span className="mb-2 block text-zinc-500">{t("生日")}</span><Input type="date" value={profile.birthday} onChange={(event) => setProfile({ ...profile, birthday: event.target.value })} /></label>
    <Button disabled={pending}>{pending ? t("保存中…") : t("保存资料")}</Button>
  </form>;
}
