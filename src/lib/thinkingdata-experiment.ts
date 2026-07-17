"use client";

export const LOGIN_COPY_FEATURE_KEY = "登录页注册引导文案";

export type LoginCopy = {
  title: string;
  description: string;
  registration_cta: string;
};

export type ThinkingDataIdentity = {
  accountId?: string;
  distinctId?: string;
};

export type ThinkingDataExperimentDetail = {
  experimentId: string;
  experimentGroupId: string;
  isControlGroup: boolean;
  bucketId?: Record<string, unknown>;
};

export type LoginCopyEvaluation = {
  value: LoginCopy;
  experiment?: ThinkingDataExperimentDetail;
};

type JsonRecord = Record<string, unknown>;

const exposureTtlMs = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseCopy(value: unknown): LoginCopy | null {
  if (typeof value === "string") {
    try {
      return parseCopy(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;
  const title = cleanString(value.title);
  const description = cleanString(value.description);
  const registrationCta = cleanString(value.registration_cta);
  return title && description && registrationCta
    ? { title, description, registration_cta: registrationCta }
    : null;
}

function normalizeExperimentDetail(value: unknown): ThinkingDataExperimentDetail | undefined {
  if (!isRecord(value)) return undefined;
  const experimentId = cleanString(value["#experiment_id"] ?? value.experiment_id);
  const experimentGroupId = cleanString(value["#experiment_group_id"] ?? value.experiment_group_id);
  const rawControl = value["#is_control_group"] ?? value.is_control_group ?? value.is_control;
  if (!experimentId || !experimentGroupId || typeof rawControl !== "boolean") return undefined;
  const bucketId = isRecord(value.bucketid) ? value.bucketid : undefined;
  return { experimentId, experimentGroupId, isControlGroup: rawControl, bucketId };
}

function matchingTopLevelDetail(value: unknown) {
  const details = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  return details.find((detail) => {
    if (!isRecord(detail)) return false;
    const featureList = detail.feature_list;
    return !Array.isArray(featureList) || featureList.includes(LOGIN_COPY_FEATURE_KEY);
  });
}

export function parseLoginCopyEvaluation(input: unknown): LoginCopyEvaluation | null {
  if (!isRecord(input)) return null;
  const root = isRecord(input.data) ? input.data : input;
  const rawFeature = root[LOGIN_COPY_FEATURE_KEY];
  const featureValue = isRecord(rawFeature) && "value" in rawFeature ? rawFeature.value : rawFeature;
  const value = parseCopy(featureValue);
  if (!value) return null;

  const featureDetail = isRecord(rawFeature) ? rawFeature.experiment_detail : undefined;
  const experiment = normalizeExperimentDetail(featureDetail)
    ?? normalizeExperimentDetail(matchingTopLevelDetail(root.experiment_detail));
  return { value, experiment };
}

export function buildExperimentFetchBody(identity: ThinkingDataIdentity, featureKey: string) {
  return Object.fromEntries(Object.entries({
    "#account_id": identity.accountId,
    "#distinct_id": identity.distinctId,
    "#feature_key": [featureKey],
    "#lib": "tga_js_sdk",
  }).filter(([, value]) => value !== undefined && value !== ""));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function exposureCacheKey(detail: ThinkingDataExperimentDetail) {
  return `thinkingdata-exposure:${detail.experimentId}:${detail.experimentGroupId}:${stableStringify(detail.bucketId ?? {})}`;
}

export async function fetchLoginCopyExperiment(): Promise<LoginCopyEvaluation | null> {
  const { getThinkingDataIdentity } = await import("@/lib/analytics");
  const identity = await getThinkingDataIdentity();
  if (!identity.accountId && !identity.distinctId) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch("/api/thinkingdata/experiment/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildExperimentFetchBody(identity, LOGIN_COPY_FEATURE_KEY)),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const evaluation = parseLoginCopyEvaluation(await response.json());
    if (!evaluation?.experiment || evaluation.experiment.bucketId) return evaluation;
    return {
      ...evaluation,
      experiment: {
        ...evaluation.experiment,
        bucketId: Object.fromEntries(Object.entries({
          "#account_id": identity.accountId,
          "#distinct_id": identity.distinctId,
        }).filter(([, value]) => value)),
      },
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function exposeLoginCopyExperiment(detail?: ThinkingDataExperimentDetail) {
  if (!detail || typeof window === "undefined") return;
  const key = exposureCacheKey(detail);
  try {
    const prior = Number(window.localStorage.getItem(key));
    if (Number.isFinite(prior) && Date.now() - prior < exposureTtlMs) return;
  } catch {
    // Storage can be unavailable in privacy mode; exposure still needs to be sent.
  }

  const { trackThinkingDataExperimentExposure } = await import("@/lib/analytics");
  trackThinkingDataExperimentExposure(detail);
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Exposure has already been queued; storage failure should not affect rendering.
  }
}
