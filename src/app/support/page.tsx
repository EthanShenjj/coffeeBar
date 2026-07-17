import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "帮助与支持 | CoffeeBar" };

export default function SupportPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@coffeebar.app";
  return <main className="mx-auto max-w-3xl px-5 py-16 text-neutral-900">
    <Link className="text-sm underline" href="/">← 返回 CoffeeBar</Link>
    <p className="mt-10 text-xs font-bold tracking-[.2em] text-neutral-500">COFFEEBAR SUPPORT</p>
    <h1 className="mt-3 text-5xl font-black tracking-tight">帮助与支持</h1>
    <p className="mt-5 max-w-xl leading-7 text-neutral-600">遇到登录、订单、购物卡、账户删除或推送通知问题，请发送邮件并附上应用版本、构建号和订单号。请勿发送密码、Bearer Token 或完整支付凭据。</p>
    <a className="mt-8 inline-flex min-h-12 items-center rounded-full bg-neutral-950 px-6 font-bold text-white" href={`mailto:${email}`}>{email}</a>
    <div className="mt-12 space-y-6 border-t border-neutral-200 pt-8 text-neutral-700">
      <section><h2 className="font-bold text-neutral-900">响应时间</h2><p className="mt-1">内测期间通常在 2 个工作日内回复。</p></section>
      <section><h2 className="font-bold text-neutral-900">账户删除</h2><p className="mt-1">在 iOS 应用进入“我的 → 隐私与账户”，输入当前密码并确认后即可发起删除，无需另行联系客服。</p></section>
      <p><Link className="underline" href="/privacy">查看隐私政策</Link></p>
    </div>
  </main>;
}
