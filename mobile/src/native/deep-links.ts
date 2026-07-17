const SUPPORTED_HOSTS = new Map([
  ["orders", "/orders/"],
  ["messages", "/messages/"],
]);
const SAFE_RESOURCE_ID = /^[A-Za-z0-9_-]{1,200}$/;

export function parseCoffeeBarUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "coffeebar:" || url.username || url.password || url.port || url.search || url.hash) return null;
    const prefix = SUPPORTED_HOSTS.get(url.hostname);
    const segments = url.pathname.split("/").filter(Boolean);
    if (!prefix || segments.length !== 1) return null;
    const id = decodeURIComponent(segments[0]!);
    return SAFE_RESOURCE_ID.test(id) ? `${prefix}${id}` : null;
  } catch {
    return null;
  }
}

type ListenerHandle = { remove(): Promise<void> };
type AppUrlPlugin = {
  getLaunchUrl(): Promise<{ url: string } | undefined>;
  addListener(event: "appUrlOpen", listener: (event: { url: string }) => void): Promise<ListenerHandle>;
};

export async function initializeDeepLinks(options: { app: AppUrlPlugin; navigate(path: string): void }) {
  const open = (value: string) => {
    const path = parseCoffeeBarUrl(value);
    if (path) options.navigate(path);
  };
  const handle = await options.app.addListener("appUrlOpen", ({ url }) => open(url));
  try {
    const launch = await options.app.getLaunchUrl();
    if (launch?.url) open(launch.url);
  } catch {
    // An unavailable launch URL must not prevent the app from starting.
  }
  return () => handle.remove();
}
