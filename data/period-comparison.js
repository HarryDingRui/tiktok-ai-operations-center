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
  function daysBetween(fromDate, toDate) {
    const from = new Date(`${fromDate}T00:00:00Z`);
    const to = new Date(`${toDate}T00:00:00Z`);
    const days = Math.round((to - from) / 86400000);
    return days > 0 ? days : 1;
  }
  function selectComparisonSnapshots(snapshots, bounds) {
    const ordered = [...(Array.isArray(snapshots) ? snapshots : [])]
      .filter((snapshot) => snapshot && isDateKey(snapshot.reportDate))
      .sort((left, right) => left.reportDate.localeCompare(right.reportDate));
    if (!ordered.length) return null;

    const start = isDateKey(bounds?.start) ? bounds.start : "";
    const end = isDateKey(bounds?.end) ? bounds.end : "";
    const selected = ordered.filter((snapshot) => {
      if (!start || !end) return true;
      return snapshot.reportDate >= start && snapshot.reportDate <= end;
    });
    if (!selected.length) return null;

    const current = selected[selected.length - 1];
    let previous = null;
    if (start && end && start === end) {
      previous = [...ordered].reverse().find((snapshot) => snapshot.reportDate < current.reportDate) || null;
    } else if (selected.length >= 2) {
      previous = selected[0];
    }
    if (!previous || previous.reportDate === current.reportDate) return null;

    const intervalDays = daysBetween(previous.reportDate, current.reportDate);
    return {
      previous,
      current,
      intervalDays,
      intervalText: intervalDays === 1 ? "环比昨日" : `对比 ${previous.reportDate}（相隔 ${intervalDays} 天）`,
    };
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
  return { isDateKey, selectedPeriodEndpoints, selectComparisonSnapshots, absoluteDeltaText, metricTrend };
}));
