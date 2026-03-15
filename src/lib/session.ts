// src/lib/session.ts

const KEY = "tastyprotein_session_id";

function generateSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Returns a stable client session id stored in localStorage.
 * Returns "server" during SSR.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "server";

  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length > 10) return existing;

    const id = generateSessionId();
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return generateSessionId();
  }
}

export function resetSessionId(): string {
  const id = generateSessionId();
  if (typeof window === "undefined") return id;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    return id;
  }
  return id;
}
