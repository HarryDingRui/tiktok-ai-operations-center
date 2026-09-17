(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OPS_PERIOD_COMPARISON = factory();
}(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function isDateKey(value) { return /^20\d{2}-\d{2}-\d{2}$/.test(String(value || "")); }
  function selectedPeriodEndpoints(bounds, availableDates) {
    if (!bounds || !isDateKey(bounds.start) || !isDateKey(bounds.end) || bounds.start > bounds.end) return { start: "", end: "" };
    const dates = [...new Set((availableDates || []).filter(isDateKey))]
      .filter((date) => date >= bounds.start && date <= bounds.end)
      .sort();
    return { start: dates[0] || bounds.start, end: dates[dates.length - 1] || bounds.end };
  }
  function absoluteDeltaText(current, previous, formatter) {
    if (current == null || previous == null) return "区间首日暂无数据";
    const delta = Number(current) - Number(previous);
    if (!Number.isFinite(delta) || delta === 0) return "持平";
    return `${delta > 0 ? "增加" : "减少"} ${formatter(Math.abs(delta))}`;
  }
  function metricTrend(current, previous, formatter) {
    if (current == null || previous == null) {
      return { state: "unavailable", symbol: "", action: "区间首日暂无数据", value: "" };
    }
    const delta = Number(current) - Number(previous);
    if (!Number.isFinite(delta)) {
      return { state: "unavailable", symbol: "", action: "区间首日暂无数据", value: "" };
    }
    if (delta === 0) return { state: "flat", symbol: "→", action: "持平", value: "" };
    return {
      state: delta > 0 ? "up" : "down",
      symbol: delta > 0 ? "↑" : "↓",
      action: delta > 0 ? "增加" : "减少",
      value: formatter(Math.abs(delta)),
    };
  }
  return { isDateKey, selectedPeriodEndpoints, absoluteDeltaText, metricTrend };
}));
