(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OPS_VIDEO_RANGE = factory();
}(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ADDITIVE_FIELDS = [
    "gmv", "orders", "items", "refund", "likes", "comments", "shares",
    "exposure", "clicks", "views", "commission",
  ];

  function summarizeVideoRows(rows) {
    const rangeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    const dates = [...new Set(rangeRows.map((row) => row.date).filter((date) => /^20\d{2}-\d{2}-\d{2}$/.test(String(date || ""))))].sort();
    const byVideo = new Map();
    rangeRows.forEach((row, index) => {
      const videoId = String(row.videoId || "").trim();
      const key = videoId || `row-${index}`;
      const current = byVideo.get(key);
      if (!current) {
        byVideo.set(key, { ...row, _productIds: new Set(row.productId ? [row.productId] : []) });
        return;
      }
      ADDITIVE_FIELDS.forEach((field) => {
        current[field] = (Number(current[field]) || 0) + (Number(row[field]) || 0);
      });
      if (row.productId) current._productIds.add(row.productId);
      if (String(row.date || "") > String(current.date || "")) {
        current.title = row.title;
        current.publishAt = row.publishAt;
        current.link = row.link;
        current.creator = row.creator;
        current.date = row.date;
      }
    });
    const aggregatedRows = [...byVideo.values()].map((row) => {
      const productIds = [...row._productIds];
      const normalized = { ...row };
      delete normalized._productIds;
      if (productIds.length > 1) normalized.productId = productIds.join(", ");
      normalized.gpm = normalized.exposure > 0 ? normalized.gmv / normalized.exposure * 1000 : (Number(normalized.gpm) || 0);
      return normalized;
    });
    const selling = aggregatedRows.filter((row) => Number(row.orders) > 0);
    const sortBy = (field) => [...selling].sort((left, right) => (Number(right[field]) || 0) - (Number(left[field]) || 0));
    return {
      start: dates[0] || "",
      end: dates[dates.length - 1] || "",
      total: aggregatedRows.length,
      sellingCount: selling.length,
      gmv: selling.reduce((sum, row) => sum + (Number(row.gmv) || 0), 0),
      sellingRows: sortBy("gmv"),
      byGpm: sortBy("gpm").slice(0, 15),
      byGmv: sortBy("gmv").slice(0, 15),
    };
  }

  return { summarizeVideoRows };
}));
