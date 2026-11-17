/**
 * Real-time and Event Timestamp Utilities
 *
 * Ensures accurate handling of ISO-8601 UTC timestamps across all browsers
 * and environments. Prevents naive timestamp timezone misinterpretations,
 * computes exact durations, and formats human-friendly relative times.
 */

/**
 * Safely parse any date value into a valid Date object.
 * If given a naive ISO string without timezone offset (e.g. from Python utcnow),
 * it appends 'Z' so browsers parse it as UTC rather than local time.
 *
 * @param {string|number|Date|null|undefined} val
 * @returns {Date|null}
 */
export function parseUtcDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === "number") {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === "string") {
    let s = val.trim();
    if (!s) return null;

    // If ISO date string without trailing Z and without +HH:MM / -HH:MM offset, append Z
    if (s.includes("T") && !s.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(s)) {
      s += "Z";
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Format a timestamp into a human-readable date and time string.
 *
 * @param {string|number|Date} val
 * @param {Object} [options]
 * @param {string} [options.fallback="—"]
 * @param {string} [options.timeZone] - e.g. "Asia/Kolkata" or undefined for local
 * @param {boolean} [options.includeSeconds=true]
 * @param {boolean} [options.dateOnly=false]
 * @param {boolean} [options.timeOnly=false]
 * @returns {string}
 */
export function formatDateTime(val, options = {}) {
  const {
    fallback = "—",
    timeZone = undefined,
    includeSeconds = true,
    dateOnly = false,
    timeOnly = false,
  } = options;

  const date = parseUtcDate(val);
  if (!date) return fallback;

  try {
    if (dateOnly) {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: timeZone || undefined,
      }).format(date);
    }

    if (timeOnly) {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: includeSeconds ? "2-digit" : undefined,
        hour12: true,
        timeZone: timeZone || undefined,
      }).format(date);
    }

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: includeSeconds ? "2-digit" : undefined,
      hour12: true,
      timeZone: timeZone || undefined,
    }).format(date);
  } catch (err) {
    console.warn("formatDateTime formatting error:", err);
    return date.toLocaleString();
  }
}

/**
 * Format relative elapsed time ("just now", "5m ago", "2h ago", "3d ago").
 *
 * @param {string|number|Date} val
 * @param {string} [fallback="—"]
 * @returns {string}
 */
export function formatTimeAgo(val, fallback = "—") {
  const date = parseUtcDate(val);
  if (!date) return fallback;

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 0) return "Just now"; // Handle slight server/client clock skew
  if (diffSec < 45) return "Just now";
  if (diffSec < 90) return "1m ago";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateTime(date, { dateOnly: true });
}

/**
 * Calculate and format genuine duration between start and end timestamps.
 * If completedAt is missing but startedAt is valid, calculates live elapsed time.
 * If startedAt is missing, returns "Not available".
 *
 * @param {string|number|Date|null} startedAt
 * @param {string|number|Date|null} [completedAt=null]
 * @param {Object} [options]
 * @param {string} [options.fallback="Not available"]
 * @param {boolean} [options.showRunningSuffix=true]
 * @returns {string}
 */
export function formatDuration(startedAt, completedAt = null, options = {}) {
  const { fallback = "Not available", showRunningSuffix = true } = options;

  const start = parseUtcDate(startedAt);
  if (!start) return fallback;

  const isRunning = !completedAt;
  const end = completedAt ? parseUtcDate(completedAt) : new Date();
  if (!end) return fallback;

  let diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) diffMs = 0;

  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  let durationStr = "";
  if (hours > 0) {
    durationStr = `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    durationStr = `${minutes}m ${seconds}s`;
  } else {
    durationStr = `${seconds}s`;
  }

  if (isRunning && showRunningSuffix) {
    return `${durationStr} (running)`;
  }

  return durationStr;
}
