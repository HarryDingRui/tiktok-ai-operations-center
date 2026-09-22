(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OPS_DATA_LOADING = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PAGE_DATASETS = Object.freeze({
    overview: [],
    alert: ["creatorDaily", "adCreatives", "affVideos", "orders"],
    bd: ["creatorDaily", "affOrders", "samples"],
    ads: ["adCreatives"],
    videos: ["affVideos", "adCreatives", "orders"],
    profit: ["orders", "affOrders"],
  });

  function datasetsForPage(pageId) {
    return [...(PAGE_DATASETS[pageId] || [])];
  }

  function mergeDatasetKeys(...groups) {
    return [...new Set(groups.flat().filter(Boolean))];
  }

  return { PAGE_DATASETS, datasetsForPage, mergeDatasetKeys };
});
