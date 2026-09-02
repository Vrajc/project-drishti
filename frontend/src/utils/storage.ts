/**
 * Writing to localStorage without letting it break the app.
 *
 * The event cache stored every event, including `mapFile` - a venue map held as
 * a base64 data URL, megabytes per event, in a store with about five megabytes
 * for the whole origin. A few events with maps filled it, and then every write
 * threw QuotaExceededError.
 *
 * That surfaced twice over. The write in the create-event path was unguarded,
 * so an event the server had already created reported "Error creating event".
 * And the same full quota would have hit the write that persists the session
 * token on sign-in: a user could be unable to log in because of cached pictures
 * of venue maps.
 *
 * So: caches are disposable and get evicted to make room for things that are
 * not, and no caller has to care whether the write succeeded unless it asks.
 */

/** Keys holding a cache — droppable at any moment, re-read from the API. */
const DISPOSABLE_KEYS = ['drishti_all_events', 'drishti_current_event'];

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Chrome/Firefox use different names; both set one of these.
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    // Safari in private mode throws a plain error with this wording.
    /quota/i.test(error.message)
  );
}

/**
 * Stores a value, evicting caches if the store is full.
 *
 * Returns whether it stuck. Callers that only wanted a cache can ignore the
 * result; callers persisting something the session depends on can react.
 * Never throws: storage can be unavailable entirely (private windows, browsers
 * with site data blocked) and that is not an error in the user's task.
 */
export function persist(key: string, value: string, { evictable = true } = {}): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaError(error) || !evictable) return false;

    // Drop the caches - except the one being written, which the caller is
    // replacing anyway - and try once more.
    for (const disposable of DISPOSABLE_KEYS) {
      if (disposable === key) continue;
      try {
        localStorage.removeItem(disposable);
      } catch {
        // Storage is unavailable; nothing further to try.
      }
    }

    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // Still no room, or storage is off. Leave no half-written entry behind:
      // a stale cache is worse than none, because the next load would trust it.
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing more to do.
      }
      return false;
    }
  }
}

/** Reads a JSON value, returning `fallback` for anything unreadable. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
