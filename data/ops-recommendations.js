/*
 * Weekly-report fluctuation rules for the local Agent center.
 * The rules are deliberately conservative: they only describe an action when
 * the workbook contains the supporting comparison, and never fill a missing
 * metric with a guessed value.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OPS_RECOMMENDATIONS = factory();
}(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function text(value) { return value == null ? "" : String(value).trim(); }
  function number(value) {
    if (value == null || value === "") return null;
    const parsed = Number(String(value).replace(/[฿$¥,%\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function percent(value) {
    const parsed = number(value);
    return parsed == null ? null : Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  }
  function storeOf(entry) { return text(entry && entry.store) || text(entry && entry.raw && entry.raw[1]) || "未标注店铺"; }
  function sourceOf(report) { return text(report && report.sourceFile) || "本地周报快照"; }
  function periodOf(report) {
    const periods = report && report.periods;
    const primary = text(periods && periods.primary && periods.primary.label);
    const comparison = text(periods && periods.comparison && periods.comparison.label);
    if (primary && comparison) return `${primary} 对比 ${comparison}`;
    return primary || "当前导入周期";
  }
  function item(kind, severity, title, evidence, action, report, tags) {
    return { kind, severity, title, evidence, action, source: sourceOf(report), tags: tags || [] };
  }
  function has(value, pattern) { return pattern.test(text(value)); }

  function fluctuationAction(raw) {
    const reason = text(raw[16]);
    const gmvChange = percent(raw[7]);
    const exposureCurrent = number(raw[8]);
    const exposurePrevious = number(raw[9]);
    const cvrCurrent = percent(raw[10]);
    const cvrPrevious = percent(raw[11]);
    const exposureChange = exposureCurrent != null && exposurePrevious != null && exposurePrevious !== 0
      ? (exposureCurrent - exposurePrevious) / Math.abs(exposurePrevious) * 100 : null;
    const cvrDelta = cvrCurrent != null && cvrPrevious != null ? cvrCurrent - cvrPrevious : null;
    if (exposureChange != null && exposureChange <= -20) {
      return "先查曝光入口、主图与搜索承接，补同商品视频/直播承接；不要先加预算。";
    }
    if (cvrDelta != null && cvrDelta <= -3) {
      return "先查详情页、评价、价格力和库存，修复转化后再放量。";
    }
    if (gmvChange != null && gmvChange <= -30) {
      return "拆分视频、直播、商品卡渠道，定位下滑来源；优先保住高贡献链接。";
    }
    if (has(reason, /曝光/)) return "先补曝光入口和内容承接，再用下一周期曝光与点击变化验证。";
    if (has(reason, /转化|CVR/)) return "先查详情页、评价、价格力和库存，再用下一周期 CVR 验证。";
    return "拆分流量、点击、转化和订单链路，先定位波动来源，再做小步调整。";
  }

  function buildDecline(entry, report) {
    const raw = entry.raw || [];
    const change = percent(raw[7]);
    const reason = text(raw[16]) || "GMV 下滑";
    const severity = change != null && change <= -30 ? "high" : "medium";
    return item("decline", severity, `${storeOf(entry)} · ${text(raw[3]) || text(raw[2]) || "商品"}下滑`, `GMV 变化 ${change == null ? "未提供" : `${change.toFixed(1)}%`}；${reason}`, fluctuationAction(raw), report, ["先定位", "避免盲目加预算"]);
  }

  function buildGrowth(entry, report) {
    const raw = entry.raw || [];
    const change = percent(raw[7]);
    return item("growth", "good", `${storeOf(entry)} · ${text(raw[3]) || text(raw[2]) || "商品"}增长`, `GMV 变化 ${change == null ? "未提供" : `+${change.toFixed(1)}%`}；${text(raw[16]) || "增长榜"}`, "在确认利润率、库存和归因稳定后，按 20%-30% 逐步加预算或复用视频结构，不一次性翻倍。", report, ["验证后放量", "20%-30% 小步扩量"]);
  }

  function buildAlert(entry, report) {
    const raw = entry.raw || [];
    const type = text(raw[4]) || "数据预警";
    const prescribed = text(raw[16]);
    let action = prescribed;
    if (!action && has(type, /CVR|转化/)) action = "检查详情页、评价、价格力和库存，修复转化后再放量。";
    if (!action && has(type, /曝光|流量/)) action = "补曝光入口和内容承接，再用下一周期曝光与点击变化验证。";
    if (!action) action = "先按预警类型排查，再用下一周期同口径数据验证，暂不把缺失字段当作 0。";
    return item("alert", has(type, /下滑|下降|异常/) ? "high" : "medium", `${storeOf(entry)} · ${type}`, `商品 ${text(raw[3]) || text(raw[2]) || "未标注"}；预警类型：${type}`, action, report, ["预警优先"]);
  }

  function buildProfit(entry, report) {
    const raw = entry.raw || [];
    const profit = number(raw[9]);
    const margin = percent(raw[10]);
    if (profit == null || profit > 0) return null;
    return item("profit", "high", `${storeOf(entry)} · ${text(raw[1]) || "SKU"}利润为负`, `毛利 ${profit}；毛利率 ${margin == null ? "未提供" : `${margin.toFixed(1)}%`}；销量 ${text(raw[3]) || "未提供"}`, "先查成本、平台费、广告费、运费与达人佣金；亏损 SKU 先限量或调价，禁止盲目放量。", report, ["利润红线", "先查成本"]);
  }

  function buildChannel(entry, report) {
    const raw = entry.raw || [];
    const channel = text(raw[0]) || "未标注渠道";
    const profit = number(raw[9]);
    if (profit == null || profit > 0) return null;
    const action = has(channel, /视频/) ? "视频渠道毛利为负，先拆视频归因、广告费、平台费和达人佣金；暂停扩大亏损渠道，保留可验证的素材测试。" : "渠道毛利为负，先拆渠道成本与归因；暂停扩大亏损渠道，保留可验证的素材测试。";
    return item("channel", "high", `${channel}渠道毛利为负`, `渠道成交额 ${text(raw[1]) || "未提供"}；毛利 ${profit}`, action, report, ["渠道止损", "拆成本归因"]);
  }

  function buildWeeklyRecommendations(report) {
    if (!report) return { source: "未导入周报", periodLabel: "暂无周期", items: [], summary: "需要先导入周报成品数据，系统才会基于真实波动生成建议。", unmappedStores: [] };
    const items = [];
    (report.declineTop || []).slice(0, 5).forEach((entry) => items.push(buildDecline(entry, report)));
    (report.alerts || []).slice(0, 5).forEach((entry) => items.push(buildAlert(entry, report)));
    (report.profitTop || []).slice(0, 5).forEach((entry) => { const recommendation = buildProfit(entry, report); if (recommendation) items.push(recommendation); });
    (report.channelProfit || []).slice(0, 3).forEach((entry) => { const recommendation = buildChannel(entry, report); if (recommendation) items.push(recommendation); });
    (report.growthTop || []).slice(0, 3).forEach((entry) => items.push(buildGrowth(entry, report)));
    const visibleItems = items.slice(0, 12);
    return {
      source: sourceOf(report), periodLabel: periodOf(report), items: visibleItems, unmappedStores: report.unmappedStores || [],
      summary: `已生成 ${visibleItems.length} 条建议：下滑 ${visibleItems.filter((entry) => entry.kind === "decline").length}、预警 ${visibleItems.filter((entry) => entry.kind === "alert").length}、利润/渠道 ${visibleItems.filter((entry) => entry.kind === "profit" || entry.kind === "channel").length}、增长 ${visibleItems.filter((entry) => entry.kind === "growth").length}。`
    };
  }

  return { buildWeeklyRecommendations };
}));
