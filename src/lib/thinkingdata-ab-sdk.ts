export type ThinkingDataAbIdentity = {
  accountId?: string;
  distinctId?: string;
  deviceId?: string;
};

export type ThinkingDataAbExperiment = {
  experimentId: string;
  experimentGroupId: string;
  isControlGroup: boolean;
  bucketId?: Record<string, unknown>;
};

export type ThinkingDataAbStorage = Pick<Storage, "getItem" | "setItem">;
type JsonRecord = Record<string, unknown>;
export type ThinkingDataAbFeature = { value: unknown; experiment?: ThinkingDataAbExperiment };
type FeatureEntry = ThinkingDataAbFeature;
type CachedSnapshot = { context: string; fetchedAt: number; features: Record<string, FeatureEntry> };

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const EXPOSURE_TTL_MS = 24 * 60 * 60 * 1000;
const RESERVED_FETCH_KEYS = new Set([
  "#account_id", "#distinct_id", "#device_id", "#custom_bucketid", "#feature_key", "#lib",
]);

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

function normalizeExperiment(value: unknown): ThinkingDataAbExperiment | undefined {
  if (!isRecord(value)) return undefined;
  const experimentId = cleanString(value["#experiment_id"] ?? value.experiment_id);
  const experimentGroupId = cleanString(value["#experiment_group_id"] ?? value.experiment_group_id);
  const control = value["#is_control_group"] ?? value.is_control_group ?? value.is_control;
  if (!experimentId || !experimentGroupId || typeof control !== "boolean") return undefined;
  const rawBucket = value.bucket_id ?? value.bucketid;
  return {
    experimentId,
    experimentGroupId,
    isControlGroup: control,
    bucketId: isRecord(rawBucket) ? rawBucket : undefined,
  };
}

function topLevelExperiments(value: unknown) {
  const candidates = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  return candidates.flatMap((candidate) => {
    if (!isRecord(candidate) || !Array.isArray(candidate.feature_list)) return [];
    const experiment = normalizeExperiment(candidate);
    return experiment ? [{ featureKeys: candidate.feature_list.filter((key): key is string => typeof key === "string"), experiment }] : [];
  });
}

export function parseThinkingDataAbResponse(input: unknown): Record<string, FeatureEntry> {
  if (!isRecord(input)) return {};
  const root = isRecord(input.data) ? input.data : input;
  const shared = topLevelExperiments(root.experiment_detail);
  return Object.fromEntries(Object.entries(root).flatMap(([featureKey, raw]) => {
    if (featureKey === "experiment_detail") return [];
    const wrapped = isRecord(raw) && ("value" in raw || "experiment_detail" in raw);
    const value = wrapped ? raw.value : raw;
    const scoped = wrapped ? normalizeExperiment(raw.experiment_detail) : undefined;
    const experiment = scoped ?? shared.find((detail) => detail.featureKeys.includes(featureKey))?.experiment;
    return [[featureKey, { value, experiment }]];
  }));
}

function readSnapshot(storage: ThinkingDataAbStorage | undefined, key: string): CachedSnapshot | null {
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null") as unknown;
    if (!isRecord(value) || typeof value.context !== "string" || typeof value.fetchedAt !== "number" || !isRecord(value.features)) return null;
    return value as CachedSnapshot;
  } catch {
    return null;
  }
}

function maybePromise(value: void | Promise<void>) {
  if (value && typeof value.then === "function") void value.catch(() => undefined);
}

export function createThinkingDataAbSdk(options: {
  appId: string;
  identity: () => ThinkingDataAbIdentity | Promise<ThinkingDataAbIdentity>;
  fetcher: (body: Record<string, unknown>) => Promise<unknown>;
  trackExposure?: (detail: ThinkingDataAbExperiment) => void | Promise<void>;
  storage?: ThinkingDataAbStorage;
  automaticExposureTracking?: boolean;
  now?: () => number;
  cacheTtlMs?: number;
}) {
  const now = options.now ?? Date.now;
  const cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL_MS;
  const cacheKey = `thinkingdata-ab:${options.appId}:features`;
  let bucketId: Record<string, unknown> = {};
  let customParams: Record<string, unknown> = {};
  let features: Record<string, FeatureEntry> = {};
  let fetchedAt = 0;
  let activeContext = "";
  const memoryExposures = new Map<string, number>();
  const inFlight = new Map<string, Promise<boolean>>();

  function context(identity: ThinkingDataAbIdentity) {
    return stableStringify({ identity, bucketId, customParams });
  }

  function activateSnapshot(identity: ThinkingDataAbIdentity) {
    const expected = context(identity);
    const snapshot = readSnapshot(options.storage, cacheKey);
    if (snapshot?.context === expected) {
      activeContext = expected;
      features = snapshot.features;
      fetchedAt = snapshot.fetchedAt;
    }
  }

  const initialIdentity = options.identity();
  if (!(initialIdentity instanceof Promise)) activateSnapshot(initialIdentity);

  function writeSnapshot() {
    try { options.storage?.setItem(cacheKey, JSON.stringify({ context: activeContext, fetchedAt, features })); } catch { /* cache is best effort */ }
  }

  function setBucketId(value: Record<string, unknown>) {
    bucketId = { ...value };
    features = {};
    fetchedAt = 0;
    const identity = options.identity();
    if (!(identity instanceof Promise)) activateSnapshot(identity);
  }

  function setCustomFetchParams(value: Record<string, unknown>) {
    customParams = Object.fromEntries(Object.entries(value).filter(([key]) => !RESERVED_FETCH_KEYS.has(key)));
    features = {};
    fetchedAt = 0;
    const identity = options.identity();
    if (!(identity instanceof Promise)) activateSnapshot(identity);
  }

  async function fetchFeatures(featureKeys?: string[]) {
    const identity = await options.identity();
    if (!cleanString(identity.accountId) && !cleanString(identity.distinctId)) return false;
    const body = Object.fromEntries(Object.entries({
      "#account_id": cleanString(identity.accountId),
      "#distinct_id": cleanString(identity.distinctId),
      "#device_id": cleanString(identity.deviceId),
      "#custom_bucketid": Object.keys(bucketId).length ? bucketId : undefined,
      "#feature_key": featureKeys?.length ? [...new Set(featureKeys)] : undefined,
      "#lib": "tga_js_sdk",
      ...customParams,
    }).filter(([, value]) => value !== undefined && value !== ""));
    const requestKey = stableStringify(body);
    const existing = inFlight.get(requestKey);
    if (existing) return existing;
    const task = (async () => {
      try {
        const parsed = parseThinkingDataAbResponse(await options.fetcher(body));
        const effectiveBucket = Object.keys(bucketId).length
          ? bucketId
          : Object.fromEntries(Object.entries({
            "#account_id": cleanString(identity.accountId),
            "#distinct_id": cleanString(identity.distinctId),
            "#device_id": cleanString(identity.deviceId),
          }).filter(([, value]) => value !== undefined));
        for (const entry of Object.values(parsed)) {
          if (entry.experiment && !entry.experiment.bucketId) entry.experiment = { ...entry.experiment, bucketId: effectiveBucket };
        }
        activeContext = context(identity);
        features = featureKeys?.length ? { ...features, ...parsed } : parsed;
        fetchedAt = now();
        writeSnapshot();
        return true;
      } catch {
        return false;
      }
    })().finally(() => inFlight.delete(requestKey));
    inFlight.set(requestKey, task);
    return task;
  }

  function exposureKey(detail: ThinkingDataAbExperiment) {
    return `thinkingdata-ab:${options.appId}:exposure:${detail.experimentId}:${detail.experimentGroupId}:${stableStringify(detail.bucketId ?? {})}`;
  }

  function expose(featureKey: string) {
    const detail = features[featureKey]?.experiment;
    if (!detail || !options.trackExposure) return false;
    const key = exposureKey(detail);
    let prior = memoryExposures.get(key) ?? 0;
    try { prior = Number(options.storage?.getItem(key)) || prior; } catch { /* use memory cache */ }
    if (prior && now() - prior < EXPOSURE_TTL_MS) return false;
    memoryExposures.set(key, now());
    try { options.storage?.setItem(key, String(now())); } catch { /* memory cache still deduplicates */ }
    try { maybePromise(options.trackExposure(detail)); } catch { /* exposure must not block feature use */ }
    return true;
  }

  function read(featureKey: string, fallback: unknown) {
    if (fetchedAt && now() - fetchedAt >= cacheTtlMs) {
      void fetchFeatures();
      return fallback;
    }
    const entry = features[featureKey];
    if (!entry) return fallback;
    if (options.automaticExposureTracking !== false) expose(featureKey);
    return entry.value;
  }

  return {
    setBucketId,
    setCustomFetchParams,
    fetch: fetchFeatures,
    async restore() {
      activateSnapshot(await options.identity());
      return Boolean(Object.keys(features).length && fetchedAt && now() - fetchedAt < cacheTtlMs);
    },
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
      const values: Record<string, unknown> = {};
      for (const key of Object.keys(features)) values[key] = read(key, undefined);
      return values;
    },
    get cacheAgeMs() { return fetchedAt ? now() - fetchedAt : null; },
    get cacheFresh() { return Boolean(fetchedAt && now() - fetchedAt < cacheTtlMs); },
  };
}
