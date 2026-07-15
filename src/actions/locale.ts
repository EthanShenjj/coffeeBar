"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export async function setLocale(value: string) {
  (await cookies()).set(LOCALE_COOKIE, normalizeLocale(value), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
}

