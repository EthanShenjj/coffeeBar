const KEY = "coffeebar.intended-route";

function isSafePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export function saveIntendedRoute(path: string) {
  if (isSafePath(path) && path !== "/login" && path !== "/register") {
    try { window.sessionStorage.setItem(KEY, path); } catch { /* Navigation still proceeds without persistence. */ }
  }
}

export function consumeIntendedRoute(fallback = "/") {
  let value: string | null = null;
  try {
    value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    return fallback;
  }
  return value && isSafePath(value) ? value : fallback;
}
