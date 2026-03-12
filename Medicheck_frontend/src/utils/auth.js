export const AUTH_REQUIRED_MESSAGE = "Please login or signup first.";
const AUTH_STORAGE_KEY = "medicheckAuth";
const LEGACY_AUTH_STORAGE_KEY = "user";
const GUEST_SESSION_KEY = "medicheckGuest";

function normalizeAuthPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const email = typeof payload.email === "string"
    ? payload.email.trim().toLowerCase()
    : typeof payload.user?.email === "string"
      ? payload.user.email.trim().toLowerCase()
      : "";
  const name = typeof payload.name === "string"
    ? payload.name.trim()
    : typeof payload.user?.name === "string"
      ? payload.user.name.trim()
      : "";
  const role = typeof payload.role === "string"
    ? payload.role.trim().toUpperCase()
    : typeof payload.user?.role === "string"
      ? payload.user.role.trim().toUpperCase()
      : "PATIENT";

  if (!token || !email) {
    return null;
  }

  return { token, email, name, role };
}

export function getAuthSession() {
  try {
    const savedUser = sessionStorage.getItem(AUTH_STORAGE_KEY);

    if (!savedUser) {
      return null;
    }

    const parsedUser = JSON.parse(savedUser);
    const normalizedPayload = normalizeAuthPayload(parsedUser);

    if (!normalizedPayload) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return normalizedPayload;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getUserInitials(name, email) {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function saveAuthSession(payload) {
  const normalizedPayload = normalizeAuthPayload(payload);

  if (!normalizedPayload) {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    return false;
  }

  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedPayload));
  sessionStorage.removeItem(GUEST_SESSION_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  return true;
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(GUEST_SESSION_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

export function enableGuestSession() {
  sessionStorage.setItem(GUEST_SESSION_KEY, "1");
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

export function isGuestSession() {
  return sessionStorage.getItem(GUEST_SESSION_KEY) === "1";
}

export function hasActiveSession() {
  try {
    const legacyUser = localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (legacyUser) {
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    }

    return Boolean(getAuthSession()) || isGuestSession();
  } catch {
    clearAuthSession();
    return false;
  }
}

export function isAdminSession() {
  const session = getAuthSession();
  return Boolean(session && session.role === "ADMIN");
}