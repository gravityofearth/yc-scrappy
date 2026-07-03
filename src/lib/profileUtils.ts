/**
 * Normalize education and employment arrays for DB storage.
 * Ensures each entry is a non-empty trimmed string so the frontend can display bullet lists correctly.
 */
export function normalizeEducationAndEmployment<T extends Record<string, unknown>>(
  profile: T
): T {
  const normalized = { ...profile } as Record<string, unknown>;

  if (Array.isArray(normalized.education)) {
    normalized.education = normalized.education
      .map((item) => (item != null ? String(item).trim() : ""))
      .filter(Boolean);
  } else {
    normalized.education = [];
  }

  if (Array.isArray(normalized.employment)) {
    normalized.employment = normalized.employment
      .map((item) => (item != null ? String(item).trim() : ""))
      .filter(Boolean);
  } else {
    normalized.employment = [];
  }

  return normalized as T;
}
