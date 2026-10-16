import * as fakeIndexedDB from "fake-indexeddb";

// Nuxt's mock provides the factory; idb also needs the IndexedDB constructors.
for (const [key, value] of Object.entries(fakeIndexedDB)) {
  if (key === "indexedDB" || key.startsWith("IDB")) {
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
}
