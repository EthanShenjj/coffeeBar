import "server-only";

import { cookies } from "next/headers";
import { createTranslator, LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export async function getLocale() {
  return normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getTranslator() {
  return createTranslator(await getLocale());
}

