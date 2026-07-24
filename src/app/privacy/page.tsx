import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "隐私政策 | CoffeeBar" };

export default function PrivacyPage() {
  return <main className="mx-auto max-w-3xl px-5 py-16 text-neutral-900">
    <Link className="text-sm underline" href="/">← 返回 CoffeeBar</Link>
    <h1 className="mt-10 text-5xl font-black tracking-tight">CoffeeBar 隐私政策</h1>
    <p className="mt-4 text-sm text-neutral-500">生效日期：2026 年 7 月 17 日</p>
    <div className="mt-10 space-y-8 leading-7 text-neutral-700">
      <section><h2 className="text-xl font-bold text-neutral-900">我们处理的数据</h2><p className="mt-2">为提供注册登录、门店自取、订单、会员、购物卡和站内消息功能，我们会处理你主动提供的姓名、邮箱、取货姓名和手机号，以及账户、模拟订单、购物卡和消息已读记录。启用订单通知后，我们还会保存设备标识和 APNs 推送令牌。</p></section>
      <section><h2 className="text-xl font-bold text-neutral-900">分析数据</h2><p className="mt-2">iOS 分析功能默认关闭。只有你在首次启动或“隐私与账户”中明确同意后，应用才会向 Amplitude、Mixpanel 和 ThinkingData 发送产品使用事件、应用版本和构建号。Web 端还会将相同的手动产品事件发送到 PostHog，但不启用 PostHog 自动采集或会话录制。CoffeeBar iOS 首版不读取 IDFA，也不启用广告归因。</p></section>
      <section><h2 className="text-xl font-bold text-neutral-900">用途、保存与共享</h2><p className="mt-2">数据仅用于完成你请求的功能、保障账户安全、提供订单通知和改进产品。服务由 Vercel、PostgreSQL 服务商、Resend、Apple 推送服务及你同意的分析服务商协助提供。我们不会出售个人数据。保存期限以提供服务和满足适用法律要求所需为限。</p></section>
      <section><h2 className="text-xl font-bold text-neutral-900">你的选择</h2><p className="mt-2">你可以拒绝推送和分析授权而继续浏览和下单，也可以在系统设置或应用内随时修改。你可以在 iOS 应用的“隐私与账户”中输入当前密码并二次确认，永久删除账户及当前模拟业务数据。</p></section>
      <section><h2 className="text-xl font-bold text-neutral-900">联系我们</h2><p className="mt-2">如需访问、更正或删除数据，或对本政策有疑问，请前往 <Link className="underline" href="/support">CoffeeBar 支持页面</Link>。</p></section>
    </div>
  </main>;
}
