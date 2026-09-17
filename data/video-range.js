(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OPS_VIDEO_RANGE = factory();
}(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function summarizeVideoRows(rows) {
    const rangeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    const dates = [...new Set(rangeRows.map((row) => row.date).filter((date) => /^20\d{2}-\d{2}-\d{2}$/.test(String(date || ""))))].sort();
    const selling = rangeRows.filter((row) => Number(row.orders) > 0);
    const sortBy = (field) => [...selling].sort((left, right) => (Number(right[field]) || 0) - (Number(left[field]) || 0));
    return {
      start: dates[0] || "",
      end: dates[dates.length - 1] || "",
      total: rangeRows.length,
      sellingCount: selling.length,
      gmv: selling.reduce((sum, row) => sum + (Number(row.gmv) || 0), 0),
      byGpm: sortBy("gpm").slice(0, 15),
      byGmv: sortBy("gmv").slice(0, 15),
    };
  }

  return { summarizeVideoRows };
}));
