/**
 * Keyboard shortcut matching.
 *
 * Pure helpers: no React, no editor knowledge. A shortcut is described once as
 * data and matched against a `KeyboardEvent`, so bindings live in a single table
 * instead of being scattered across components.
 */

export interface Shortcut {
  /** `event.key`, compared case-insensitively. */
  key: string;
  /** Cmd on macOS, Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** True when the platform's primary modifier (Cmd / Ctrl) is held. */
export function hasModifier(event: KeyboardEvent): boolean {
  return isMacPlatform() ? event.metaKey : event.ctrlKey;
}

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: Shortcut,
): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  if (hasModifier(event) !== Boolean(shortcut.mod)) return false;
  if (event.shiftKey !== Boolean(shortcut.shift)) return false;
  if (event.altKey !== Boolean(shortcut.alt)) return false;
  return true;
}

/**
 * True when the event came from a text field, where editor shortcuts must not
 * fire (typing "v" in an input should not paste).
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/** Human-readable form for tooltips, e.g. "Cmd+Z". */
export function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.mod) parts.push(isMacPlatform() ? "Cmd" : "Ctrl");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.alt) parts.push("Alt");
  parts.push(
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
  );
  return parts.join("+");
}
