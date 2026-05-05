export function register() {
  if (typeof window !== 'undefined') {
    return;
  }

  const storage = (
    globalThis as typeof globalThis & {
      localStorage?: unknown;
    }
  ).localStorage;

  if (!storage || typeof (storage as Storage).getItem === 'function') {
    return;
  }

  try {
    Reflect.deleteProperty(globalThis, 'localStorage');
  } catch {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      enumerable: true,
      value: undefined,
      writable: true,
    });
  }
}
