const memory = new Map<string, string>();

const fallbackStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value); },
  removeItem: (key) => { memory.delete(key); },
};

export function getSafeLocalStorage() {
  try {
    return window.localStorage as Pick<Storage, "getItem" | "setItem" | "removeItem">;
  } catch {
    return fallbackStorage;
  }
}
