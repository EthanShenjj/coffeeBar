"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { trackAnalytics } from "@/lib/analytics";

const zhWeekDays = ["一", "二", "三", "四", "五", "六", "日"];
const enWeekDays = ["M", "T", "W", "T", "F", "S", "S"];
const calendarStartYear = 2025;

type Month = {
  year: number;
  month: number;
};

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month: month - 1, day };
}

function moveMonth(value: Month, amount: number): Month {
  const date = new Date(Date.UTC(value.year, value.month + amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CoffeeCalendar({ coffeeDays, today }: { coffeeDays: string[]; today: string }) {
  const { locale, t } = useI18n();
  const weekDays = locale === "zh" ? zhWeekDays : enWeekDays;
  const current = parseDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState<Month>({ year: current.year, month: current.month });
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const years = Array.from({ length: Math.max(1, current.year - calendarStartYear + 1) }, (_, index) => calendarStartYear + index);
  const markedDays = useMemo(() => new Set(coffeeDays), [coffeeDays]);
  const leadingBlanks = (new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + 1, 0)).getUTCDate();
  const monthPrefix = `${visibleMonth.year}-${String(visibleMonth.month + 1).padStart(2, "0")}-`;
  const monthCount = coffeeDays.filter((day) => day.startsWith(monthPrefix)).length;
  const isCurrentMonth = visibleMonth.year === current.year && visibleMonth.month === current.month;
  const isFirstMonth = visibleMonth.year === calendarStartYear && visibleMonth.month === 0;

  useEffect(() => {
    if (!yearMenuOpen) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!yearMenuRef.current?.contains(event.target as Node)) setYearMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setYearMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [yearMenuOpen]);

  function selectYear(year: number) {
    trackAnalytics("coffee_calendar_navigated", { navigation_type: "year", year });
    setVisibleMonth((month) => ({
      year,
      month: year === current.year ? Math.min(month.month, current.month) : month.month,
    }));
    setYearMenuOpen(false);
  }

  return (
    <section className="rounded-[1.5rem] border bg-white p-5 sm:p-6" aria-labelledby="coffee-calendar-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-black text-white">
              <Coffee className="size-4" />
            </div>
            <div>
              <h2 id="coffee-calendar-title" className="text-sm font-medium">{t("咖啡日历")}</h2>
              <p className="mt-0.5 text-xs text-zinc-400">{t("每一杯，都是今天的印记。")}</p>
            </div>
          </div>
        </div>
        <div ref={yearMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setYearMenuOpen((open) => !open)}
            className={cn(
              "flex h-11 min-w-32 items-center gap-2 rounded-2xl border bg-white px-3.5 text-sm font-medium shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50",
              yearMenuOpen && "border-black bg-zinc-50",
            )}
            aria-label={t("选择年份")}
            aria-haspopup="listbox"
            aria-expanded={yearMenuOpen}
            aria-controls="coffee-calendar-year-options"
          >
            <CalendarDays className="size-4 text-zinc-400" aria-hidden="true" />
            <span className="flex-1 text-left font-mono">{locale === "zh" ? `${visibleMonth.year}年` : visibleMonth.year}</span>
            <ChevronDown className={cn("size-4 text-zinc-400 transition-transform duration-200", yearMenuOpen && "rotate-180")} aria-hidden="true" />
          </button>

          {yearMenuOpen && <div
            id="coffee-calendar-year-options"
            role="listbox"
            aria-label={t("选择年份")}
            className="absolute right-0 top-full z-30 mt-2 w-40 overflow-hidden rounded-2xl border bg-white p-1.5 shadow-xl shadow-black/10"
          >
            {years.map((year) => {
              const selected = year === visibleMonth.year;
              return <button
                key={year}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectYear(year)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                  selected ? "bg-black font-medium text-white" : "hover:bg-zinc-100",
                )}
              >
                <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                <span className="font-mono">{locale === "zh" ? `${year}年` : year}</span>
              </button>;
            })}
          </div>}
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xl font-semibold tracking-[-.04em]">{t("{year}年 {month}月", { year: visibleMonth.year, month: visibleMonth.month + 1 })}</p>
          <p className="mt-1 text-xs text-zinc-400">{t("本月 {count} 天喝过咖啡", { count: monthCount })}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { trackAnalytics("coffee_calendar_navigated", { navigation_type: "previous_month", year: visibleMonth.year, month: visibleMonth.month + 1 }); setVisibleMonth((month) => moveMonth(month, -1)); }}
            disabled={isFirstMonth}
            className="flex size-9 items-center justify-center rounded-full border bg-white hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-white"
            aria-label={t("上个月")}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => { trackAnalytics("coffee_calendar_navigated", { navigation_type: "next_month", year: visibleMonth.year, month: visibleMonth.month + 1 }); setVisibleMonth((month) => moveMonth(month, 1)); }}
            disabled={isCurrentMonth}
            className="flex size-9 items-center justify-center rounded-full border bg-white hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-white"
            aria-label={t("下个月")}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 text-center text-[10px] text-zinc-400">
        {weekDays.map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const key = dateKey(visibleMonth.year, visibleMonth.month, day);
          const marked = markedDays.has(key);
          const isToday = key === today;
          const isFuture = key > today;
          return (
            <div key={key} className="flex min-h-11 items-center justify-center sm:min-h-12">
              <div
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-full text-xs sm:size-10",
                  marked && "bg-black font-semibold text-white",
                  isToday && !marked && "border border-black font-semibold",
                  isFuture && "text-zinc-300",
                )}
                title={marked ? t("{month}月{day}日，点过咖啡", { month: visibleMonth.month + 1, day }) : undefined}
                aria-label={marked ? t("{month}月{day}日，点过咖啡", { month: visibleMonth.month + 1, day }) : t("{month}月{day}日", { month: visibleMonth.month + 1, day })}
              >
                <span className={cn(marked && "-translate-y-1")}>{day}</span>
                {marked && <Coffee className="absolute bottom-1 size-2.5" aria-hidden="true" />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-zinc-400">
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-black" />{t("已点咖啡")}</span>
        <span>{t("完成点单后自动记录")}</span>
      </div>
    </section>
  );
}
