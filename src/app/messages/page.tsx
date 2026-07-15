import { AppFrame } from "@/components/app-frame";
import { MessagesList } from "@/components/messages-list";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/auth";
import { getAnnouncements } from "@/lib/dashboard";
import { getTranslator } from "@/lib/i18n-server";
export async function generateMetadata() { const t = await getTranslator(); return { title: t("消息中心") }; }
export default async function MessagesPage() { const [messages, session, t] = await Promise.all([getAnnouncements(), getSession(), getTranslator()]); const unread = messages.filter((item) => !item.read).length; return <AppFrame><SiteHeader session={session} /><main className="mx-auto max-w-3xl px-5 py-9"><p className="text-xs uppercase tracking-[.22em] text-zinc-400">Inbox</p><div className="mb-8 mt-3 flex items-end justify-between"><h1 className="text-4xl font-semibold tracking-[-.06em]">{t("消息中心")}</h1><span className="rounded-full bg-black px-3 py-1 text-xs text-white">{t("{count} 条未读", { count: unread })}</span></div><MessagesList initial={messages} /></main></AppFrame>; }
