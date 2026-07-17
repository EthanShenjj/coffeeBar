import {
  parseThinkingDataAbResponse,
  type ThinkingDataAbExperiment,
  type ThinkingDataAbFeature,
  type ThinkingDataAbIdentity,
} from "@/lib/thinkingdata-ab-sdk";

type JsonRecord = Record<string, unknown>;
type FetchOptions = { bucketId?: JsonRecord };
type ExposurePayload = {
  identity: ThinkingDataAbIdentity;
  experiment: ThinkingDataAbExperiment;
  properties: JsonRecord;
};

const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_EVENT_CACHE_TIME_MS = 1_440 * 60 * 1_000;
const DEFAULT_EVENT_CACHE_SIZE = 10_000;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function observe(value: void | Promise<void>) {
  if (value && typeof value.then === "function") void value.catch(() => undefined);
}

function evaluation(
  features: Record<string, ThinkingDataAbFeature>,
  expose: (featureKey: string, properties?: JsonRecord) => boolean,
) {
  function read(featureKey: string, fallback: unknown) {
    return featureKey in features ? features[featureKey].value : fallback;
  }
  return {
    expose,
    peekFeature(featureKey: string) {
      const entry = features[featureKey];
      return entry ? { value: entry.value, experiment: entry.experiment ? { ...entry.experiment } : undefined } : null;
    },
    getFeature: <T>(featureKey: string, fallback: T) => read(featureKey, fallback) as T,
    getValueAsString(featureKey: string, fallback: string) {
      const value = read(featureKey, fallback);
      return typeof value === "string" ? value : fallback;
    },
    getValueAsDouble(featureKey: string, fallback: number) {
      const value = read(featureKey, fallback);
      return typeof value === "number" && Number.isFinite(value) ? value : fallback;
    },
    getValueAsBoolean(featureKey: string, fallback: boolean) {
      const value = read(featureKey, fallback);
      return typeof value === "boolean" ? value : fallback;
    },
    getJson<T extends object>(featureKey: string, fallback: T) {
      const value = read(featureKey, fallback);
      if (typeof value === "string") {
        try {
          const parsed: unknown = JSON.parse(value);
          return parsed && typeof parsed === "object" ? parsed as T : fallback;
        } catch { return fallback; }
      }
      return value && typeof value === "object" ? value as T : fallback;
    },
    getAllValues() {
      return Object.fromEntries(Object.entries(features).map(([key, entry]) => [key, entry.value]));
    },
  };
}

export function createThinkingDataServerAbSdk(options: {
  fetcher: (body: JsonRecord, signal: AbortSignal) => Promise<unknown>;
  trackExposure?: (payload: ExposurePayload) => void | Promise<void>;
  lib?: string;
  timeoutMs?: number;
  attempts?: number;
  eventCacheTimeMs?: number;
  eventCacheSize?: number;
  now?: () => number;
}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const eventCacheTimeMs = options.eventCacheTimeMs ?? DEFAULT_EVENT_CACHE_TIME_MS;
  const eventCacheSize = options.eventCacheSize ?? DEFAULT_EVENT_CACHE_SIZE;
  const now = options.now ?? Date.now;
  const inFlight = new Map<string, Promise<Record<string, ThinkingDataAbFeature>>>();
  const exposureCache = new Map<string, number>();

  async function attempt(body: JsonRecord) {
    let lastError: unknown;
    for (let index = 0; index < attempts; index += 1) {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutFailure = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error("ThinkingData experiment fetch timed out"));
          }, timeoutMs);
        });
        return parseThinkingDataAbResponse(await Promise.race([options.fetcher(body, controller.signal), timeoutFailure]));
      } catch (error) {
        lastError = error;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("ThinkingData experiment fetch failed");
  }

  return {
    async fetch(identity: ThinkingDataAbIdentity, featureKeys?: string[], fetchOptions: FetchOptions = {}) {
      const normalizedIdentity = {
        accountId: cleanString(identity.accountId),
        distinctId: cleanString(identity.distinctId),
        deviceId: cleanString(identity.deviceId),
      };
      if (!normalizedIdentity.accountId && !normalizedIdentity.distinctId) {
        throw new Error("ThinkingData server AB SDK requires accountId or distinctId");
      }
      const bucketId = fetchOptions.bucketId && Object.keys(fetchOptions.bucketId).length ? { ...fetchOptions.bucketId } : undefined;
      const body = Object.fromEntries(Object.entries({
        "#account_id": normalizedIdentity.accountId,
        "#distinct_id": normalizedIdentity.distinctId,
        custom_bucketid: bucketId,
        "#feature_key": featureKeys?.length ? [...new Set(featureKeys)] : undefined,
        "#lib": options.lib ?? "tga_node_sdk",
      }).filter(([, value]) => value !== undefined && value !== ""));
      const requestKey = stableStringify(body);
      const pending = inFlight.get(requestKey) ?? attempt(body).finally(() => inFlight.delete(requestKey));
      if (!inFlight.has(requestKey)) inFlight.set(requestKey, pending);
      const features = await pending;
      const effectiveBucket = bucketId ?? Object.fromEntries(Object.entries({
        "#account_id": normalizedIdentity.accountId,
        "#distinct_id": normalizedIdentity.distinctId,
      }).filter(([, value]) => value !== undefined));
      for (const entry of Object.values(features)) {
        if (entry.experiment && !entry.experiment.bucketId) entry.experiment = { ...entry.experiment, bucketId: effectiveBucket };
      }

      return evaluation(features, (featureKey, properties = {}) => {
        const detail = features[featureKey]?.experiment;
        if (!detail || !options.trackExposure) return false;
        const key = stableStringify({
          bucketId: detail.bucketId ?? effectiveBucket,
          experimentId: detail.experimentId,
          experimentGroupId: detail.experimentGroupId,
        });
        const prior = exposureCache.get(key);
        if (prior !== undefined && now() - prior < eventCacheTimeMs) return false;
        if (prior !== undefined) exposureCache.delete(key);
        while (exposureCache.size >= Math.max(1, eventCacheSize)) {
          const oldest = exposureCache.keys().next().value as string | undefined;
          if (!oldest) break;
          exposureCache.delete(oldest);
        }
        exposureCache.set(key, now());
        try { observe(options.trackExposure({ identity, experiment: detail, properties })); } catch { /* exposure cannot break business logic */ }
        return true;
      });
    },
  };
}
