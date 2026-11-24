/**
 * Per-browser preferences (language, panel width…). Storage can be unavailable (private mode,
 * blocked site data): the preference is then simply not remembered.
 */
const PREFIX = 'greasy-notes.';

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // not remembered
  }
}
