"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, Clock3 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

const PICKUP_LEAD_MINUTES = 15;
const PICKUP_INTERVAL_MINUTES = 30;
const OPEN_MINUTES = 10 * 60;
const CLOSE_MINUTES = 21 * 60 + 30;

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date) {
  return toDateTimeLocalValue(date).slice(0, 10);
}

export function pickupSlotsForWindow(minValue: string, maxValue: string) {
  const min = new Date(minValue);
  const max = new Date(maxValue);
  if (!Number.isFinite(min.getTime()) || !Number.isFinite(max.getTime()) || min > max) return [];

  const slots: string[] = [];
  for (let day = startOfDay(min); day <= max; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    for (let minutes = OPEN_MINUTES; minutes <= CLOSE_MINUTES; minutes += PICKUP_INTERVAL_MINUTES) {
      const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
      if (slot >= min && slot <= max) slots.push(toDateTimeLocalValue(slot));
    }
  }
  return slots;
}

export function createPickupWindow(now = new Date()) {
  const current = new Date(now);
  current.setSeconds(0, 0);
  const min = new Date(current.getTime() + PICKUP_LEAD_MINUTES * 60_000);
  const max = new Date(current.getTime() + 3 * 24 * 60 * 60_000);
  const minValue = toDateTimeLocalValue(min);
  const maxValue = toDateTimeLocalValue(max);
  const [defaultValue = minValue] = pickupSlotsForWindow(minValue, maxValue);
  return { min: minValue, max: maxValue, defaultValue };
}

function sameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function PickupTimePicker({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
}) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = "pickup-time-options";
  const slots = useMemo(() => pickupSlotsForWindow(min, max), [max, min]);
  const days = useMemo(() => {
    const grouped = new Map<string, { date: Date; slots: string[] }>();
    slots.forEach((slot) => {
      const date = new Date(slot);
      const key = dateKey(date);
      const current = grouped.get(key);
      if (current) current.slots.push(slot);
      else grouped.set(key, { date, slots: [slot] });
    });
    return Array.from(grouped, ([key, day]) => ({ key, ...day }));
  }, [slots]);
  const selectedDayKey = value.slice(0, 10);
  const selectedDay = days.find((day) => day.key === selectedDayKey) ?? days[0];
  const selectedDate = new Date(value);
  const localeCode = locale === "zh" ? "zh-CN" : "en-US";
  const today = startOfDay(new Date());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function dayName(date: Date) {
    if (sameDate(date, today)) return t("今天");
    if (sameDate(date, tomorrow)) return t("明天");
    return new Intl.DateTimeFormat(localeCode, { weekday: "short" }).format(date);
  }

  const selectedLabel = Number.isFinite(selectedDate.getTime())
    ? `${new Intl.DateTimeFormat(localeCode, { month: "short", day: "numeric", weekday: "short" }).format(selectedDate)} · ${value.slice(11)}`
    : t("选择取货日期和时间");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left outline-none transition hover:border-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100">
          <CalendarDays className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-zinc-400">{t("已选取货时间")}</span>
          <span className="mt-0.5 block truncate text-[15px] font-medium">{selectedLabel}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-zinc-400 transition", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div id={panelId} role="dialog" aria-label={t("选择取货日期和时间")} className="absolute inset-x-0 top-[calc(100%+8px)] z-30 rounded-2xl border bg-white p-4 shadow-2xl shadow-black/10 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[.16em] text-zinc-400">{t("选择日期")}</p>
            <p className="text-xs text-zinc-400">{t("未来 3 天内")}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {days.map((day) => {
              const selected = day.key === selectedDay?.key;
              return (
                <button
                  type="button"
                  key={day.key}
                  aria-pressed={selected}
                  onClick={() => onChange(day.slots[0])}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition hover:border-zinc-500",
                    selected && "border-black bg-black text-white hover:border-black",
                  )}
                >
                  <span className={cn("block text-xs", selected ? "text-white/60" : "text-zinc-400")}>{dayName(day.date)}</span>
                  <span className="mt-1 block text-sm font-medium">
                    {new Intl.DateTimeFormat(localeCode, { month: "numeric", day: "numeric" }).format(day.date)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[.16em] text-zinc-400">{t("选择时间")}</p>
              <span className="flex items-center gap-1.5 text-xs text-zinc-400"><Clock3 className="size-3.5" />10:00—21:30</span>
            </div>
            <div className="mt-3 grid max-h-52 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
              {selectedDay?.slots.map((slot) => {
                const selected = slot === value;
                return (
                  <button
                    type="button"
                    key={slot}
                    aria-pressed={selected}
                    onClick={() => {
                      onChange(slot);
                      setOpen(false);
                    }}
                    className={cn(
                      "relative min-h-11 rounded-xl border font-mono text-sm transition hover:border-zinc-500 hover:bg-zinc-50",
                      selected && "border-black bg-black text-white hover:border-black hover:bg-black",
                    )}
                  >
                    {slot.slice(11)}
                    {selected && <Check className="absolute right-2 top-2 size-3" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-4 border-t pt-3 text-xs leading-5 text-zinc-400">{t("营业时间 10:00—21:30，每 30 分钟可选")}</p>
        </div>
      )}
    </div>
  );
}
