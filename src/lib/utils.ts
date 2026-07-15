import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
  }).format(value / 100);
}

export function formatOrderNumber(date = new Date()) {
  const stamp = date
    .toISOString()
    .replace(/\D/g, "")
    .slice(2, 14);
  return `CB${stamp}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}
