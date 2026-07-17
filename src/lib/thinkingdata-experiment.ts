"use client";

import {
  createThinkingDataAbSdk,
  parseThinkingDataAbResponse,
  type ThinkingDataAbExperiment,
  type ThinkingDataAbIdentity,
} from "@/lib/thinkingdata-ab-sdk";

export const LOGIN_COPY_FEATURE_KEY = "登录页注册引导文案";

export type LoginCopy = {
  title: string;
  description: string;
  registration_cta: string;
};

export type ThinkingDataIdentity = ThinkingDataAbIdentity;
export type ThinkingDataExperimentDetail = ThinkingDataAbExperiment;
export type LoginCopyEvaluation = { value: LoginCopy; experiment?: ThinkingDataExperimentDetail };

type JsonRecord = Record<string, unknown>;
let browserSdk: ReturnType<typeof createThinkingDataAbSdk> | null = null;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseCopy(value: unknown): LoginCopy | null {
  if (typeof value === "string") {
    try { return parseCopy(JSON.parse(value)); } catch { return null; }
  }
  if (!isRecord(value)) return null;
  const title = cleanString(value.title);
  const description = cleanString(value.description);
  const registrationCta = cleanString(value.registration_cta);
  return title && description && registrationCta ? { title, description, registration_cta: registrationCta } : null;
}

export function parseLoginCopyEvaluation(input: unknown): LoginCopyEvaluation | null {
  const entry = parseThinkingDataAbResponse(input)[LOGIN_COPY_FEATURE_KEY];
  const value = parseCopy(entry?.value);
  return value ? { value, experiment: entry?.experiment } : null;
}

export function buildExperimentFetchBody(
  identity: ThinkingDataIdentity,
  featureKey: string,
  options: { bucketId?: Record<string, unknown>; params?: Record<string, unknown> } = {},
) {
  const reserved = new Set(["#account_id", "#distinct_id", "#device_id", "#custom_bucketid", "#feature_key", "#lib"]);
  const params = Object.fromEntries(Object.entries(options.params ?? {}).filter(([key]) => !reserved.has(key)));
  return Object.fromEntries(Object.entries({
    "#account_id": identity.accountId,
    "#distinct_id": identity.distinctId,
    "#device_id": identity.deviceId,
    "#custom_bucketid": options.bucketId && Object.keys(options.bucketId).length ? options.bucketId : undefined,
    "#feature_key": [featureKey],
    "#lib": "tga_js_sdk",
    ...params,
  }).filter(([, value]) => value !== undefined && value !== ""));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function exposureCacheKey(detail: ThinkingDataExperimentDetail) {
  return `thinkingdata-exposure:${detail.experimentId}:${detail.experimentGroupId}:${stableStringify(detail.bucketId ?? {})}`;
}

function getBrowserSdk() {
  if (typeof window === "undefined") return null;
  if (browserSdk) return browserSdk;
  browserSdk = createThinkingDataAbSdk({
    appId: process.env.NEXT_PUBLIC_THINKINGDATA_APP_ID ?? "coffeebar",
    storage: window.localStorage,
    identity: async () => {
      const { getThinkingDataIdentity } = await import("@/lib/analytics");
      return getThinkingDataIdentity();
    },
    fetcher: async (body) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1_800);
      try {
        const response = await fetch("/api/thinkingdata/experiment/fetch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("experiment fetch failed");
        return response.json();
      } finally {
        window.clearTimeout(timeout);
      }
    },
    trackExposure: async (detail) => {
      const { trackThinkingDataExperimentExposure } = await import("@/lib/analytics");
      trackThinkingDataExperimentExposure(detail);
    },
  });
  browserSdk.setCustomFetchParams({ "#app_version": process.env.NEXT_PUBLIC_APP_VERSION });
  return browserSdk;
}

export async function fetchLoginCopyExperiment(): Promise<LoginCopyEvaluation | null> {
  const sdk = getBrowserSdk();
  if (!sdk) return null;
  if (!await sdk.restore()) await sdk.fetch([LOGIN_COPY_FEATURE_KEY]);
  const entry = sdk.peekFeature(LOGIN_COPY_FEATURE_KEY);
  const value = parseCopy(entry?.value);
  return value ? { value, experiment: entry?.experiment } : null;
}

export function exposeLoginCopyExperiment() {
  return getBrowserSdk()?.expose(LOGIN_COPY_FEATURE_KEY) ?? false;
}
