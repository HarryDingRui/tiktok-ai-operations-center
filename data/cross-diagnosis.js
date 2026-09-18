(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OPS_CROSS_DIAGNOSIS = factory();
}(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DECLINE_THRESHOLD = 0.2;
  const RATE_DECLINE_THRESHOLD = 0.02;
  const MODULE_ORDER = ["ads", "creators", "videos", "product", "orders"];

  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function number(value) {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function sum(rows, field) {
    const values = rows.map((row) => number(row?.[field])).filter((value) => value != null);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  }

  function uniqueCount(rows, field, positiveField) {
    const values = rows
      .filter((row) => positiveField == null || (number(row?.[positiveField]) || 0) > 0)
      .map((row) => text(row?.[field]))
      .filter(Boolean);
    return values.length ? new Set(values).size : null;
  }

  function datesIn(rows) {
    return [...new Set(rows.map((row) => text(row?.date)).filter(Boolean))].sort();
  }

  function filterRows(rows, productId, bounds, store) {
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (!row || text(row.productId) !== text(productId)) return false;
      if (store && store !== "all" && text(row.store) !== store) return false;
      const date = text(row.date);
      if (!date) return false;
      if (bounds?.start && date < bounds.start) return false;
      if (bounds?.end && date > bounds.end) return false;
      return true;
    });
  }

  function rowsOnDate(rows, date) {
    return rows.filter((row) => text(row.date) === date);
  }

  function endpoint(rows, date) {
    return date ? rowsOnDate(rows, date) : [];
  }

  function change(start, end) {
    if (start == null || end == null) return null;
    return { start, end, delta: end - start, relative: start ? (end - start) / Math.abs(start) : null };
  }

  function declineIssue(key, label, start, end, threshold = DECLINE_THRESHOLD) {
    const metric = change(start, end);
    if (!metric || start <= 0 || metric.delta >= 0 || metric.delta > -Math.abs(start) * threshold) return null;
    return { key, label, ...metric };
  }

  function rateDeclineIssue(key, label, start, end, threshold = RATE_DECLINE_THRESHOLD) {
    const metric = change(start, end);
    if (!metric || metric.delta >= -threshold) return null;
    return { key, label, ...metric };
  }

  function rateIncreaseIssue(key, label, start, end, threshold = RATE_DECLINE_THRESHOLD) {
    const metric = change(start, end);
    if (!metric || metric.delta <= threshold) return null;
    return { key, label, ...metric };
  }

  function issueText(issue, format) {
    return `${issue.label}从${format(issue.start)}降至${format(issue.end)}`;
  }

  function countFields(rows, names) {
    const fields = {};
    names.forEach((name) => {
      fields[name] = rows.some((row) => number(row?.[name]) != null);
    });
    return fields;
  }

  function makeModule(key, label, rows, period, evaluator, missingText) {
    const dates = datesIn(rows);
    if (!rows.length) {
      return {
        key, label, status: "pending", coverage: { dates: [], start: "", end: "", count: 0 },
        facts: {}, issues: [], evidence: [missingText], actions: [],
      };
    }
    if (dates.length < 2) {
      return {
        key, label, status: "pending", coverage: { dates, start: dates[0] || "", end: dates.at(-1) || "", count: rows.length },
        facts: evaluator(rowsOnDate(rows, dates[0]), rowsOnDate(rows, dates[0]), rows).facts,
        issues: [], evidence: [`仅有${dates.length}个有效日期（${dates[0] || "未知"}），不足以比较所选区间首末日`, missingText], actions: [],
      };
    }
    const result = evaluator(endpoint(rows, dates[0]), endpoint(rows, dates.at(-1)), rows);
    const status = result.issues.length ? "problem" : result.pendingFields?.length ? "pending" : "normal";
    return {
      key, label, status,
      coverage: { dates, start: dates[0], end: dates.at(-1), count: rows.length },
      facts: result.facts, issues: result.issues, evidence: result.evidence, actions: result.actions,
    };
  }

  function evaluateAds(startRows, endRows, allRows) {
    const aggregate = (rows) => {
      const spend = sum(rows, "spend");
      const revenue = sum(rows, "revenue");
      const orders = sum(rows, "orders");
      const impressions = sum(rows, "impressions");
      const clicks = sum(rows, "clicks");
      return {
        plans: new Set(rows.map((row) => text(row.campaignId || row.plan)).filter(Boolean)).size || null,
        spend, revenue, orders, impressions, clicks,
        roi: spend > 0 && revenue != null ? revenue / spend : null,
        ctr: impressions > 0 && clicks != null ? clicks / impressions : null,
      };
    };
    const start = aggregate(startRows), end = aggregate(endRows);
    const issues = [
      declineIssue("spend", "广告消耗", start.spend, end.spend),
      declineIssue("roi", "广告 ROI", start.roi, end.roi),
      rateDeclineIssue("ctr", "广告 CTR", start.ctr, end.ctr),
    ].filter(Boolean);
    const evidence = [
      `计划数${start.plans ?? "待补充"}→${end.plans ?? "待补充"}，消耗${start.spend ?? "待补充"}→${end.spend ?? "待补充"}，ROI${start.roi == null ? "待补充" : start.roi.toFixed(2)}→${end.roi == null ? "待补充" : end.roi.toFixed(2)}`,
    ];
    issues.forEach((issue) => evidence.push(issueText(issue, (value) => issue.key === "spend" ? value.toFixed(2) : value.toFixed(2))));
    return {
      facts: { start, end, availableFields: countFields(allRows, ["spend", "revenue", "orders", "impressions", "clicks"]) },
      issues, evidence, actions: issues.length ? ["核对广告预算、计划状态、出价和定向变更记录"] : [],
    };
  }

  function evaluateCreators(startRows, endRows, allRows) {
    const creators = (rows) => [...new Set(rows.filter((row) => (number(row.qty) ?? 1) > 0).map((row) => text(row.creator)).filter(Boolean))];
    const startCreators = creators(startRows), endCreators = creators(endRows);
    const lostCreators = startCreators.filter((creator) => !endCreators.includes(creator));
    const startCount = startCreators.length || null, endCount = endCreators.length || null;
    const issues = [declineIssue("creatorCount", "带货达人数", startCount, endCount)].filter(Boolean);
    if (lostCreators.length && !issues.length) issues.push({ key: "lostCreators", label: "停带达人", start: startCreators.length, end: endCreators.length, delta: endCreators.length - startCreators.length, relative: null });
    return {
      facts: { startCount, endCount, startCreators, endCreators, lostCreators, availableFields: countFields(allRows, ["qty", "amount", "creator"]) },
      issues,
      evidence: [`带货达人${startCount ?? "待补充"}→${endCount ?? "待补充"}${lostCreators.length ? `，停带：${lostCreators.slice(0, 5).join("、")}` : ""}`],
      actions: issues.length ? ["核查头部达人是否停更或断带，并补充同商品达人合作"] : [],
    };
  }

  function evaluateVideos(startRows, endRows, allRows) {
    const aggregate = (rows) => {
      const videos = [...new Set(rows.map((row) => text(row.videoId)).filter(Boolean))];
      const exposure = sum(rows, "exposure");
      const views = sum(rows, "views");
      const likes = sum(rows, "likes") || 0;
      const comments = sum(rows, "comments") || 0;
      const shares = sum(rows, "shares") || 0;
      const interactionBase = views || exposure;
      return {
        videoCount: videos.length || null,
        exposure, views, gmv: sum(rows, "gmv"), orders: sum(rows, "orders"),
        engagementRate: interactionBase ? (likes + comments + shares) / interactionBase : null,
      };
    };
    const start = aggregate(startRows), end = aggregate(endRows);
    const issues = [
      declineIssue("videoCount", "带货视频数量", start.videoCount, end.videoCount),
      declineIssue("exposure", "视频曝光", start.exposure, end.exposure),
      declineIssue("views", "视频播放", start.views, end.views),
      rateDeclineIssue("engagementRate", "视频互动率", start.engagementRate, end.engagementRate),
    ].filter(Boolean);
    return {
      facts: { start, end, availableFields: countFields(allRows, ["videoId", "exposure", "views", "likes", "comments", "shares", "gmv", "orders"]) },
      issues,
      evidence: [`带货视频${start.videoCount ?? "待补充"}→${end.videoCount ?? "待补充"}，曝光${start.exposure ?? "待补充"}→${end.exposure ?? "待补充"}，视频归因GMV${start.gmv ?? "待补充"}→${end.gmv ?? "待补充"}`],
      actions: issues.length ? ["补充带货视频供给，并检查低播放或低互动素材是否持续重复投放"] : [],
    };
  }

  function readField(row, names) {
    for (const name of names) {
      if (row && row[name] != null && row[name] !== "") return row[name];
    }
    return null;
  }

  function evaluateProduct(startRows, endRows, allRows) {
    const start = startRows[0] || {}, end = endRows[0] || {};
    const price = [readField(start, ["price", "salePrice", "activityPrice"]), readField(end, ["price", "salePrice", "activityPrice"])];
    const stock = [readField(start, ["stock", "inventory", "availableStock"]), readField(end, ["stock", "inventory", "availableStock"])];
    const status = [readField(start, ["status", "productStatus"]), readField(end, ["status", "productStatus"])];
    const penalty = [readField(start, ["penalty", "penaltyStatus", "restriction"]), readField(end, ["penalty", "penaltyStatus", "restriction"])];
    const issues = [];
    if (price.every((value) => value != null) && Number(price[0]) !== Number(price[1])) issues.push({ key: "price", label: "商品价格变动", start: price[0], end: price[1], delta: Number(price[1]) - Number(price[0]), relative: Number(price[0]) ? (Number(price[1]) - Number(price[0])) / Number(price[0]) : null });
    if (stock.every((value) => value != null) && Number(stock[0]) !== Number(stock[1])) issues.push({ key: "stock", label: "库存变动", start: stock[0], end: stock[1], delta: Number(stock[1]) - Number(stock[0]), relative: Number(stock[0]) ? (Number(stock[1]) - Number(stock[0])) / Number(stock[0]) : null });
    if (status.every((value) => value != null) && text(status[0]) !== text(status[1])) issues.push({ key: "status", label: "商品状态变动", start: status[0], end: status[1], delta: null, relative: null });
    if (penalty.some((value) => value != null) && penalty.some((value) => /处罚|限制|下架|违规|penalt|restrict/i.test(text(value)))) issues.push({ key: "penalty", label: "存在处罚或限制记录", start: penalty[0], end: penalty[1], delta: null, relative: null });
    const operationalFields = { price: price.every((value) => value != null), stock: stock.every((value) => value != null), status: status.every((value) => value != null), penalty: penalty.every((value) => value != null) };
    return {
      facts: { start: { price: price[0], stock: stock[0], status: status[0], penalty: penalty[0] }, end: { price: price[1], stock: stock[1], status: status[1], penalty: penalty[1] }, operationalFields },
      issues,
      evidence: [`价格${price[0] ?? "待补充"}→${price[1] ?? "待补充"}，库存${stock[0] ?? "待补充"}→${stock[1] ?? "待补充"}，状态${status[0] ?? "待补充"}→${status[1] ?? "待补充"}，处罚字段${operationalFields.penalty ? (penalty[1] ?? "无") : "待补充"}`],
      actions: issues.length ? ["核对商品价格、库存、详情页改动及平台处罚记录"] : [],
      pendingFields: Object.keys(operationalFields).filter((field) => !operationalFields[field]),
    };
  }

  function evaluateOrders(startRows, endRows, allRows) {
    const aggregate = (rows) => {
      const orderIds = [...new Set(rows.map((row) => text(row.orderId)).filter(Boolean))];
      const amount = sum(rows, "orderAmount");
      const refund = sum(rows, "refund");
      return { orderCount: orderIds.length || null, qty: sum(rows, "qty"), amount, refund, refundRate: amount > 0 && refund != null ? refund / amount : null };
    };
    const start = aggregate(startRows), end = aggregate(endRows);
    const issues = [
      declineIssue("orderCount", "订单量", start.orderCount, end.orderCount),
      rateIncreaseIssue("refundRate", "退款率", start.refundRate, end.refundRate),
    ].filter(Boolean);
    return {
      facts: { start, end, availableFields: countFields(allRows, ["orderId", "qty", "orderAmount", "refund"]) },
      issues,
      evidence: [`订单${start.orderCount ?? "待补充"}→${end.orderCount ?? "待补充"}，退款金额${start.refund ?? "待补充"}→${end.refund ?? "待补充"}，退款率${start.refundRate == null ? "待补充" : (start.refundRate * 100).toFixed(2) + "%"}→${end.refundRate == null ? "待补充" : (end.refundRate * 100).toFixed(2) + "%"}`],
      actions: issues.length ? ["核查退款、差评、物流时效和订单承接环节"] : [],
    };
  }

  function modulePending(result) {
    return result.status === "pending";
  }

  function buildConclusion(modules) {
    const problems = MODULE_ORDER.map((key) => modules.find((module) => module.key === key)).filter((module) => module?.status === "problem");
    const excluded = MODULE_ORDER.map((key) => modules.find((module) => module.key === key)).filter((module) => module?.status === "normal");
    const pending = MODULE_ORDER.map((key) => modules.find((module) => module.key === key)).filter((module) => modulePending(module));
    const primary = problems[0] ? { module: problems[0].key, text: problems[0].issues.map((issue) => issue.label).join("、") } : null;
    const secondary = problems.slice(1).map((module) => ({ module: module.key, text: module.issues.map((issue) => issue.label).join("、") }));
    const actions = [...new Set(problems.flatMap((module) => module.actions))].slice(0, 3);
    return { primary, secondary, excluded: excluded.map((module) => ({ module: module.key, text: `${module.label}未发现超过阈值的异常` })), pending: pending.map((module) => ({ module: module.key, text: `${module.label}数据不足，不能排除` })), actions };
  }

  function buildCrossDiagnosis(input) {
    const productId = text(input?.productId);
    const bounds = input?.bounds || null;
    const store = text(input?.store) || "all";
    const groups = [input?.productRows, input?.adRows, input?.creatorRows, input?.videoRows, input?.orderRows];
    const allDates = [...new Set(groups.flatMap((rows) => (Array.isArray(rows) ? rows : []).map((row) => text(row?.date)).filter(Boolean)))].sort();
    const selectedStart = text(bounds?.start), selectedEnd = text(bounds?.end);
    const periodStart = selectedStart || allDates[0] || "";
    const periodEnd = selectedEnd || allDates.at(-1) || "";
    const period = {
      selectedStart, selectedEnd, start: periodStart, end: periodEnd,
    };
    const productRows = filterRows(input?.productRows, productId, bounds, store);
    const adRows = filterRows(input?.adRows, productId, bounds, store);
    const creatorRows = filterRows(input?.creatorRows, productId, bounds, store);
    const videoRows = filterRows(input?.videoRows, productId, bounds, store);
    const orderRows = filterRows(input?.orderRows, productId, bounds, store);
    const modules = [
      makeModule("ads", "广告", adRows, period, evaluateAds, "广告数据未导入或没有该商品记录，无法验证广告消耗、ROI和CTR"),
      makeModule("creators", "达人", creatorRows, period, evaluateCreators, "没有带商品ID的达人订单记录，无法验证达人数量和停带情况"),
      makeModule("videos", "视频", videoRows, period, evaluateVideos, "视频数据未导入或没有该商品记录，无法验证视频供给和素材表现"),
      makeModule("product", "商品", productRows, period, evaluateProduct, "商品快照不足，无法验证价格、库存、状态和处罚记录"),
      makeModule("orders", "订单", orderRows, period, evaluateOrders, "订单明细未导入或没有该商品记录，无法验证退款和物流售后"),
    ];
    return {
      productId, store, period, modules,
      productName: text(productRows[0]?.name || productRows.at(-1)?.name),
      conclusion: buildConclusion(modules),
    };
  }

  return { buildCrossDiagnosis };
}));
