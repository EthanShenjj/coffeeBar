type ApiBaseUrlInput = {
  configured: string | undefined;
  fallbackOrigin: string;
  native: boolean;
  production: boolean;
};

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function resolveApiBaseUrl(input: ApiBaseUrlInput) {
  const candidate = input.configured?.trim() || (!input.native ? input.fallbackOrigin : "");
  if (!candidate) throw new Error("VITE_API_BASE_URL 未配置");
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("VITE_API_BASE_URL 不是有效 URL");
  }
  const developmentLocalhost = !input.production && parsed.protocol === "http:" && isLocalhost(parsed.hostname);
  if (parsed.protocol !== "https:" && !developmentLocalhost) {
    throw new Error("移动端 API 必须使用 HTTPS；仅开发环境允许 localhost HTTP");
  }
  return parsed.origin;
}
