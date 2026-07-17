const KEY = "coffeebar.intended-route";

function isSafePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export function saveIntendedRoute(path: string) {
  if (isSafePath(path) && path !== "/login" && path !== "/register") {
    window.sessionStorage.setItem(KEY, path);
  }
}

export function consumeIntendedRoute(fallback = "/") {
  const value = window.sessionStorage.getItem(KEY);
  window.sessionStorage.removeItem(KEY);
  return value && isSafePath(value) ? value : fallback;
}
