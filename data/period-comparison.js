(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OPS_PERIOD_COMPARISON = factory();
}(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function isDateKey(value) { return /^20\d{2}-\d{2}-\d{2}$/.test(String(value || "")); }
  function addDays(dateKey, days) {
    if (!isDateKey(dateKey)) return "";
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function daysBetweenInclusive(start, end) {
    if (!isDateKey(start) || !isDateKey(end)) return 0;
    const from = new Date(`${start}T00:00:00Z`);
    const to = new Date(`${end}T00:00:00Z`);
    return Math.max(0, Math.round((to - from) / 86400000) + 1);
  }
  function previousPeriodBounds(bounds) {
    if (!bounds || !isDateKey(bounds.start) || !isDateKey(bounds.end) || bounds.start > bounds.end) return { start: "", end: "" };
    const days = daysBetweenInclusive(bounds.start, bounds.end);
    const end = addDays(bounds.start, -1);
    return { start: addDays(end, -(days - 1)), end };
  }
  function absoluteDeltaText(current, previous, formatter) {
    if (current == null || previous == null) return "上期暂无数据";
    const delta = Number(current) - Number(previous);
    if (!Number.isFinite(delta) || delta === 0) return "持平";
    return `${delta > 0 ? "增加" : "减少"} ${formatter(Math.abs(delta))}`;
  }
  return { isDateKey, addDays, daysBetweenInclusive, previousPeriodBounds, absoluteDeltaText };
}));
