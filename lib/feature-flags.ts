const enabledValues = new Set(["1", "true", "yes", "on"]);

/**
 * Feature flag server-side untuk endpoint Wawasan Cerdas.
 * Default aktif supaya mode preview dan kontrak API tetap dapat ditinjau.
 * Set ENGAGEMENT_INSIGHTS_ENABLED=false (atau 0/off) untuk menonaktifkannya.
 */
export function isEngagementInsightsEnabled(value = process.env.ENGAGEMENT_INSIGHTS_ENABLED) {
  if (value === undefined) return true;
  return enabledValues.has(value.trim().toLowerCase());
}
