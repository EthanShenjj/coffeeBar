"use client";

import {
  parseThinkingDataAbResponse,
  type ThinkingDataAbExperiment,
  type ThinkingDataAbIdentity,
} from "@/lib/thinkingdata-ab-sdk";

export const LOGIN_COPY_FEATURE_KEY = "login_registration_copy";
export const OFFICIAL_EXPERIMENT_SCRIPT_SOURCES = [
  "/vendor/thinkingdata.umd.min.js",
  "/vendor/tdremoteconfig.umd.min.js",
  "/vendor/tdexperiment.umd.min.js",
] as const;

export type LoginCopy = {
  title: string;
  description: string;
  registration_cta: string;
};

export const DEFAULT_LOGIN_COPY: LoginCopy = {
  title: "欢迎回来。",
  description: "登录后保存订单、累计等级，并在任何设备继续结算。",
  registration_cta: "还没有账号？立即注册",
};

export type ThinkingDataIdentity = ThinkingDataAbIdentity;
export type ThinkingDataExperimentDetail = ThinkingDataAbExperiment;
export type LoginCopyEvaluation = { value: LoginCopy; experiment?: ThinkingDataExperimentDetail };
export type OfficialExperimentSdk = {
  init: (config: Record<string, unknown>) => void;
  getValueAsJson: (key: string, defaultValue: JsonRecord) => unknown;
  exposure?: (key: string) => void;
};

type JsonRecord = Record<string, unknown>;
let officialSdkPromise: Promise<OfficialExperimentSdk | null> | null = null;
const vendorScriptPromises = new Map<string, Promise<void>>();

declare global {
  interface Window {
    TDExperiment?: OfficialExperimentSdk;
    TDRemoteConfig?: unknown;
  }
}

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

export function createOfficialExperimentConfig({
  appId,
  serverUrl,
  enableLog = false,
}: {
  appId: string;
  serverUrl: string;
  enableLog?: boolean;
}) {
  return {
    appId,
    serverUrl,
    automaticExposureTracking: true,
    customBucketId: {},
    customFetchParams: {},
    enableLog,
  };
}

export function initializeOfficialExperimentSdk(
  sdk: OfficialExperimentSdk,
  options: { appId: string; serverUrl: string; enableLog?: boolean },
) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, 3_500);

    try {
      sdk.init({
        ...createOfficialExperimentConfig(options),
        onFetchSuccess: finish,
        onFetchFailure: finish,
      });
    } catch {
      finish();
    }
  });
}

export async function loadOfficialExperimentSdk({
  initializeAnalytics,
  loadScript,
  getSdk,
  config,
}: {
  initializeAnalytics: () => Promise<unknown>;
  loadScript: (src: string) => Promise<unknown>;
  getSdk: () => OfficialExperimentSdk | undefined;
  config: { appId: string; serverUrl: string; enableLog?: boolean };
}) {
  await initializeAnalytics();
  await loadScript(OFFICIAL_EXPERIMENT_SCRIPT_SOURCES[1]);
  await loadScript(OFFICIAL_EXPERIMENT_SCRIPT_SOURCES[2]);
  const sdk = getSdk();
  if (!sdk) return null;
  await initializeOfficialExperimentSdk(sdk, config);
  return sdk;
}

export function readOfficialLoginCopy(
  sdk: Pick<OfficialExperimentSdk, "getValueAsJson">,
): LoginCopyEvaluation | null {
  const value = parseCopy(sdk.getValueAsJson(LOGIN_COPY_FEATURE_KEY, DEFAULT_LOGIN_COPY));
  return value ? { value } : null;
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

function loadVendorScript(src: string) {
  if (typeof document === "undefined") return Promise.reject(new Error("browser unavailable"));
  const existingPromise = vendorScriptPromises.get(src);
  if (existingPromise) return existingPromise;

  const task = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const script = existing ?? document.createElement("script");
    const complete = () => resolve();
    const fail = () => reject(new Error(`failed to load ${src}`));
    script.addEventListener("load", complete, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!existing) {
      script.src = src;
      script.async = false;
      script.dataset.analyticsVendor = "thinkingdata";
      document.head.appendChild(script);
    }
  });
  vendorScriptPromises.set(src, task);
  return task;
}

function getOfficialBrowserSdk() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (officialSdkPromise) return officialSdkPromise;
  const appId = process.env.NEXT_PUBLIC_THINKINGDATA_APP_ID;
  const serverUrl = process.env.NEXT_PUBLIC_THINKINGDATA_SERVER_URL;
  if (!appId || !serverUrl) return Promise.resolve(null);

  officialSdkPromise = loadOfficialExperimentSdk({
    initializeAnalytics: async () => {
      const { getThinkingDataIdentity } = await import("@/lib/analytics");
      await getThinkingDataIdentity(3_500);
    },
    loadScript: loadVendorScript,
    getSdk: () => window.TDExperiment,
    config: {
      appId,
      serverUrl,
      enableLog: process.env.NODE_ENV !== "production",
    },
  }).catch(() => null);
  return officialSdkPromise;
}

export async function fetchLoginCopyExperiment(): Promise<LoginCopyEvaluation | null> {
  const sdk = await getOfficialBrowserSdk();
  if (!sdk) return null;
  return readOfficialLoginCopy(sdk);
}

export function exposeLoginCopyExperiment() {
  if (typeof window === "undefined" || !window.TDExperiment?.exposure) return false;
  window.TDExperiment.exposure(LOGIN_COPY_FEATURE_KEY);
  return true;
}
