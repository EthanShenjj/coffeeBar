"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/i18n-provider";
import { authClient } from "@/lib/auth-client";
import { identifyAnalytics, trackAnalytics } from "@/lib/analytics";
import { completeRegistration } from "@/lib/registration-flow";
import { registrationDeviceProfileProperties } from "@/lib/registration-device-profile";
import {
  exposeLoginCopyExperiment,
  fetchLoginCopyExperiment,
  type LoginCopyEvaluation,
} from "@/lib/thinkingdata-experiment";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loginCopyEvaluation, setLoginCopyEvaluation] = useState<LoginCopyEvaluation | null>(null);

  useEffect(() => {
    if (mode !== "login") return;
    let active = true;
    void fetchLoginCopyExperiment().then((evaluation) => {
      if (active && evaluation) setLoginCopyEvaluation(evaluation);
    });
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    if (loginCopyEvaluation?.experiment) exposeLoginCopyExperiment();
  }, [loginCopyEvaluation]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true);
    const hasNext = Boolean(params.get("next"));
    if (mode === "signup") {
      trackAnalytics("register_submitted", { has_next: hasNext });
    } else {
      trackAnalytics("login_submitted", { has_next: hasNext });
    }
    const result = mode === "login" ? await authClient.signIn.email({ email: form.email, password: form.password }) : await authClient.signUp.email({ name: form.name, email: form.email, password: form.password });
    setPending(false);
    if (result.error) {
      if (mode === "signup") {
        trackAnalytics("register_failed", { has_next: hasNext });
      } else {
        trackAnalytics("login_failed", { has_next: hasNext });
      }
      return toast.error(result.error.message ?? t("操作失败"));
    }
    if (mode === "signup") {
      trackAnalytics("register", { has_next: hasNext, register_method: "email_password", ...registrationDeviceProfileProperties() });
      await completeRegistration({
        next: params.get("next"),
        signOut: async () => { await authClient.signOut(); },
        notifySuccess: () => toast.success(t("注册成功，请登录")),
        navigate: (href) => { router.push(href); router.refresh(); },
      });
      return;
    }
    identifyAnalytics(result.data?.user?.id);
    trackAnalytics("login", { has_next: hasNext, login_method: "email_password" });
    toast.success(t("欢迎回来"));
    router.push(params.get("next") || "/"); router.refresh();
  }
  const next = params.get("next");
  const alternatePath = mode === "login" ? "/register" : "/login";
  const alternateHref = next ? `${alternatePath}?next=${encodeURIComponent(next)}` : alternatePath;
  const experimentCopy = mode === "login" ? loginCopyEvaluation?.value : undefined;
  return <div className="w-full max-w-md"><div className="flex items-center justify-between"><Link href="/menu" className="text-lg font-semibold tracking-[-.06em]">COFFEEBAR /</Link><LanguageSwitcher /></div><div className="mt-12"><p className="text-xs uppercase tracking-[.22em] text-zinc-400">Member account</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">{experimentCopy?.title ?? t(mode === "login" ? "欢迎回来。" : "加入 CoffeeBar。")}</h1><p className="mt-3 text-sm leading-6 text-zinc-500">{experimentCopy?.description ?? t("登录后保存订单、累计等级，并在任何设备继续结算。")}</p></div><form onSubmit={submit} className="mt-8 space-y-4">{mode === "signup" && <label className="block text-sm"><span className="mb-2 block text-zinc-500">{t("昵称")}</span><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required /></label>}<label className="block text-sm"><span className="mb-2 block text-zinc-500">{t("邮箱")}</span><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" required /></label><label className="block text-sm"><span className="mb-2 flex justify-between text-zinc-500">{t("密码")} {mode === "login" && <span className="text-black">{t("忘记密码")}</span>}</span><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label><Button className="w-full" size="lg" disabled={pending}>{pending ? t("请稍候…") : t(mode === "login" ? "登录" : "创建账号")}</Button></form><Link href={alternateHref} className="mt-6 block w-full text-center text-sm text-zinc-500 hover:text-black">{experimentCopy?.registration_cta ?? t(mode === "login" ? "还没有账号？立即注册" : "已有账号？返回登录")}</Link><p className="mt-10 text-center text-[11px] leading-5 text-zinc-400">{t("继续即表示你同意 CoffeeBar 的服务条款与隐私政策。")}</p></div>;
}
