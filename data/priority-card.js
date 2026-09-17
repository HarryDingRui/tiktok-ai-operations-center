(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OPS_PRIORITY_CARD = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function severityLabel(severity) {
    return ({ high: "高优先级", medium: "中优先级", low: "低优先级", good: "增长标杆" })[severity] || "待关注";
  }

  function directionSymbol(direction) {
    return ({ up: "↑", down: "↓", flat: "→", unavailable: "—" })[direction] || "—";
  }

  function renderMetric(metric) {
    const direction = ["up", "down", "flat", "unavailable"].includes(metric.direction) ? metric.direction : "unavailable";
    return `<div class="priority-metric priority-metric-${direction}">
      <div class="priority-metric-label">${escapeHtml(metric.label)}</div>
      <div class="priority-metric-flow"><span>${escapeHtml(metric.from)}</span><b aria-hidden="true">${directionSymbol(direction)}</b><strong>${escapeHtml(metric.to)}</strong></div>
      <div class="priority-metric-delta">${escapeHtml(metric.delta)}</div>
    </div>`;
  }

  function renderLegacyCard(item) {
    const tagClass = { high: "tag-red", medium: "tag-yellow", low: "tag-blue", good: "tag-green" };
    return `<div class="priority-item sev-${escapeHtml(item.sev)}">
      <div class="priority-item-title">${item.title || ""}</div>
      <div class="priority-item-body">${item.body || ""}</div>
      <div class="priority-item-tags">${(item.tags || []).map((tag, index) => `<span class="tag ${index === 0 ? (tagClass[item.sev] || "tag-gray") : "tag-gray"}">${escapeHtml(tag)}</span>`).join("")}</div>
    </div>`;
  }

  function renderPriorityCard(item) {
    if (!item || !item.decision) return renderLegacyCard(item || {});

    const decision = item.decision;
    const productId = escapeHtml(decision.productId);
    const impact = decision.impact
      ? `<div class="priority-impact"><span>预计影响</span><strong>${escapeHtml(decision.impact)}</strong></div>`
      : "";
    const actions = (decision.actions || []).map((action) => `<li>${escapeHtml(action)}</li>`).join("");
    const tags = (item.tags || []).slice(1).map((tag) => `<span class="tag tag-gray">${escapeHtml(tag)}</span>`).join("");

    return `<article class="priority-item sev-${escapeHtml(item.sev)} priority-decision-card">
      <div class="priority-decision-head">
        <div class="priority-decision-heading">
          <span class="priority-severity">${severityLabel(item.sev)}</span>
          <h4>${escapeHtml(item.title)}</h4>
        </div>
        ${impact}
      </div>
      <div class="priority-product-line">
        <strong>${escapeHtml(decision.storeName)}</strong>
        <span class="priority-product-name">${escapeHtml(decision.productName)}</span>
        <span class="priority-product-id">商品 ID <b>${productId}</b></span>
        <button type="button" class="priority-copy-button" data-copy-product-id="${productId}" aria-label="复制商品 ID ${productId}">复制 ID</button>
        <span class="priority-interval">${escapeHtml(decision.interval)}</span>
      </div>
      <div class="priority-metrics">${(decision.metrics || []).map(renderMetric).join("")}</div>
      <div class="priority-primary-action"><span>今天先做</span><strong>${escapeHtml(decision.primaryAction)}</strong></div>
      <details class="priority-details">
        <summary>查看诊断详情</summary>
        <div class="priority-diagnosis"><span>原因判断</span><p>${escapeHtml(decision.diagnosis)}</p></div>
        ${actions ? `<div class="priority-action-list"><span>执行步骤</span><ol>${actions}</ol></div>` : ""}
      </details>
      ${tags ? `<div class="priority-item-tags">${tags}</div>` : ""}
    </article>`;
  }

  function sortPriorityItems(items) {
    const severityOrder = { high: 0, medium: 1, low: 2, good: 3 };
    return [...(items || [])].sort((left, right) => {
      const severityDifference = (severityOrder[left.sev] ?? 4) - (severityOrder[right.sev] ?? 4);
      if (severityDifference) return severityDifference;
      const impactDifference = Number(right.impactValue || 0) - Number(left.impactValue || 0);
      if (impactDifference) return impactDifference;
      return Number(right.score || 0) - Number(left.score || 0);
    });
  }

  function selectPriorityItems(items, limit) {
    const selected = [];
    const seen = new Set();
    for (const item of sortPriorityItems(items)) {
      const key = item.dedupeKey || Symbol("priority-item");
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(item);
      if (selected.length >= limit) break;
    }
    return selected;
  }

  return { renderPriorityCard, sortPriorityItems, selectPriorityItems };
});
