function ensureTestLocalStorage(): void {
  const backing = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (key) => backing.get(key) ?? null,
    key: (index) => [...backing.keys()][index] ?? null,
    removeItem: (key) => {
      backing.delete(key);
    },
    setItem: (key, value) => {
      backing.set(key, String(value));
    },
  };

  try {
    if (typeof globalThis.localStorage?.setItem === "function") {
      globalThis.localStorage.setItem("__vitest_probe__", "1");
      globalThis.localStorage.removeItem("__vitest_probe__");
      return;
    }
  } catch {
    // Node may expose a broken experimental localStorage; replace with an in-memory store.
  }

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
}

ensureTestLocalStorage();
