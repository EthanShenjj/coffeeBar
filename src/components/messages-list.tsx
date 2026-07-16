"use client";
import { useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { markMessageRead } from "@/actions/account";
import { useI18n } from "@/components/i18n-provider";
import { trackAnalytics } from "@/lib/analytics";

type Message = { id: string; title: string; summary: string; date: string; read: boolean };
export function MessagesList({ initial }: { initial: Message[] }) { const [items, setItems] = useState(initial); const { t } = useI18n(); async function read(id: string) { const item = items.find((entry) => entry.id === id); trackAnalytics("message_opened", { message_id: id, was_unread: item ? !item.read : undefined }); setItems((all) => all.map((item) => item.id === id ? { ...item, read: true } : item)); await markMessageRead(id); } return <div className="space-y-3">{items.map((item) => <button key={item.id} onClick={() => read(item.id)} className="flex w-full items-center gap-4 rounded-[1.5rem] border bg-white p-5 text-left transition hover:border-black"><div className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-zinc-100"><Bell className="size-5" />{!item.read && <span className="absolute right-0 top-0 size-2.5 rounded-full border-2 border-white bg-black" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="font-medium">{t(item.title)}</h2><span className="font-mono text-[11px] text-zinc-400">{item.date}</span></div><p className="mt-1 line-clamp-1 text-sm text-zinc-500">{t(item.summary)}</p></div><ChevronRight className="size-4 text-zinc-300" /></button>)}</div>; }
