(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./period-comparison.js"));
  else root.OPS_OVERVIEW_METRICS = factory(root.OPS_PERIOD_COMPARISON);
}(typeof window !== "undefined" ? window : globalThis, function (periodTools) {
  "use strict";

  function buildOverviewMetricModels(totals, startTotals, endTotals, formatters) {
    const trend = (key, formatter) => periodTools.metricTrend(endTotals[key], startTotals[key], formatter);
    return [
      {
        key: "gmv",
        value: formatters.money(totals.gmv),
        trend: trend("gmv", formatters.money),
      },
      {
        key: "orders",
        value: `${formatters.number(totals.orders)} 单`,
        trend: trend("orders", (value) => `${formatters.number(value)} 单`),
      },
      {
        key: "exposure",
        value: formatters.compact(totals.exposure),
        trend: trend("exposure", (value) => `${formatters.compact(value)} 次`),
      },
      {
        key: "cvr",
        value: formatters.percent(totals.cvr),
        trend: trend("cvr", formatters.percentagePoint),
      },
    ];
  }

  return { buildOverviewMetricModels };
}));
