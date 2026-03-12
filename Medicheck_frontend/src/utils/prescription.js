import { getAuthSession } from "./auth";

export const UPLOAD_REQUIRED_MESSAGE = "Please upload prescription first.";
const PRESCRIPTION_UPLOADED_SESSION_KEY = "medicheckPrescriptionUploaded";

export function getCurrentUserEmail() {
  return getAuthSession()?.email || "";
}

export function isPrescriptionOwnedByCurrentUser(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const currentEmail = getCurrentUserEmail().toLowerCase();
  const ownerEmail = String(entry.ownerEmail || "").toLowerCase();

  if (!currentEmail) {
    return ownerEmail === "";
  }

  return ownerEmail === currentEmail;
}

export function getActivePrescriptionForCurrentUser() {
  try {
    const extracted = JSON.parse(localStorage.getItem("extractedText")) || [];
    const active = Array.isArray(extracted) ? extracted[0] : null;

    return isPrescriptionOwnedByCurrentUser(active) ? active : null;
  } catch {
    return null;
  }
}

export function markPrescriptionUploaded() {
  sessionStorage.setItem(PRESCRIPTION_UPLOADED_SESSION_KEY, "1");
}

export function clearPrescriptionUploadFlag() {
  sessionStorage.removeItem(PRESCRIPTION_UPLOADED_SESSION_KEY);
}

export function hasUploadedPrescription() {
  try {
    const hasUploadFlag = sessionStorage.getItem(PRESCRIPTION_UPLOADED_SESSION_KEY) === "1";
    if (!hasUploadFlag) {
      return false;
    }

    return Boolean(getActivePrescriptionForCurrentUser());
  } catch {
    return false;
  }
}
