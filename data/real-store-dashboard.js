(function () {
  "use strict";

  const data = window.REAL_STORE_DATA;
  if (!data || !Array.isArray(data.stores)) return;

  let selectedStore = "all";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value, maximumFractionDigits) {
    if (value == null || !Number.isFinite(Number(value))) return "待导入";
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(Number(value));
  }

  function formatMoney(value) {
    if (value == null || !Number.isFinite(Number(value))) return "待导入";
    return `฿${formatNumber(value, 0)}`;
  }

  function formatCompact(value) {
    if (value == null || !Number.isFinite(Number(value))) return "待导入";
    const number = Number(value);
    if (number >= 1000000) return `${(number / 1000000).toFixed(2)}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
    return formatNumber(number, 0);
  }

  function formatPercent(value, digits = 2) {
    if (value == null || !Number.isFinite(Number(value))) return "待导入";
    return `${Number(value).toFixed(digits)}%`;
  }

  function storesInScope() {
    return selectedStore === "all" ? data.stores : data.stores.filter((store) => store.name === selectedStore);
  }

  function productsInScope() {
    return storesInScope().flatMap((store) => store.products.map((product) => ({ ...product, store: store.name, reportDate: store.reportDate })));
  }

  function totalsInScope() {
    const products = productsInScope();
    const totals = products.reduce((accumulator, product) => {
      accumulator.gmv += product.gmv ?? 0;
      accumulator.orders += product.orders ?? 0;
      accumulator.units += product.units ?? 0;
      accumulator.exposure += product.exposure ?? 0;
      accumulator.clicks += product.clicks ?? 0;
      accumulator.addToCart += product.addToCart ?? 0;
      return accumulator;
    }, { gmv: 0, orders: 0, units: 0, exposure: 0, clicks: 0, addToCart: 0 });
    totals.productCount = products.length;
    totals.ctr = totals.exposure ? totals.clicks / totals.exposure * 100 : null;
    totals.cvr = totals.clicks ? totals.orders / totals.clicks * 100 : null;
    return totals;
  }

  function scopeLabel() {
    return selectedStore === "all" ? "全部店铺" : selectedStore;
  }

  function reportDateLabel() {
    const dates = [...new Set(storesInScope().map((store) => store.reportDate))].sort();
    return dates.length === 1 ? dates[0] : `${dates[0]} 至 ${dates[dates.length - 1]}`;
  }

  function productStatus(product) {
    return product.status === "可售" ? "已导入" : (product.status || "需关注");
  }

  function statusTag(status) {
    const className = status === "已导入" ? "tag-blue" : status === "可售" ? "tag-green" : "tag-yellow";
    return `<span class="tag ${className}">${escapeHtml(status)}</span>`;
  }

  function updateContextBar() {
    const summary = document.getElementById("data-context-summary");
    if (!summary) return;
    const storeCount = storesInScope().length;
    const productCount = totalsInScope().productCount;
    summary.textContent = `${storeCount} 个店铺 · ${formatNumber(productCount, 0)} 个商品 · 报表 ${reportDateLabel()}`;
  }

  function updateOverviewStats() {
    const page = document.getElementById("page-overview");
    const statsRow = page && page.querySelector(".stats-row");
    if (!statsRow) return;
    const cards = [...statsRow.querySelectorAll(".stat-card")];
    const totals = totalsInScope();
    const scope = scopeLabel();
    const values = [formatMoney(totals.gmv), formatNumber(totals.orders, 0), formatCompact(totals.exposure), formatPercent(totals.cvr)];
    const descriptions = [
      `${scope} · ${reportDateLabel()} 商品清单`,
      `${scope} · 订单数合计`,
      `${scope} · 商品曝光次数`,
      `${scope} · 订单数 ÷ 商品点击量`,
    ];
    cards.forEach((card, index) => {
      const value = card.querySelector(".stat-value");
      const trend = card.querySelector(".stat-trend");
      if (value) value.textContent = values[index];
      if (trend) trend.textContent = descriptions[index];
    });

    const productCard = [...page.querySelectorAll(".card")].find((card) => card.textContent.includes("🛍️ 商品经营"));
    if (productCard) {
      const largeValue = productCard.querySelector("div[style*='font-size:32px']");
      const description = productCard.querySelector("div[style*='font-size:13px']");
      if (largeValue) largeValue.textContent = formatNumber(totals.productCount, 0);
      if (description) description.innerHTML = `${scope} 当前商品记录<br><span style="color:#64748b;font-weight:600;">数据来自真实 product_list 文件</span>`;
    }
  }

  function renderPriorityPanel() {
    const page = document.getElementById("page-overview");
    if (!page) return;
    const card = [...page.querySelectorAll(".card")].find((candidate) => candidate.textContent.includes("今日优先处理"));
    if (!card) return;
    const list = card.querySelector("div[style*='flex-direction:column']");
    if (!list) return;
    const products = productsInScope().sort((left, right) => (right.gmv ?? 0) - (left.gmv ?? 0));
    const topGmv = products[0];
    const topUnits = [...products].sort((left, right) => (right.units ?? 0) - (left.units ?? 0))[0];
    list.innerHTML = [
      topGmv ? `<div style="padding:12px;background:#eff6ff;border-radius:8px;border-left:3px solid #3b82f6;">
        <div style="font-weight:600;color:#1e40af;margin-bottom:3px;">💰 GMV 最高链接 · ${escapeHtml(topGmv.id)}</div>
        <div style="font-size:12px;color:#1e3a8a;">${escapeHtml(topGmv.name)} · ${escapeHtml(topGmv.store)} · ${formatMoney(topGmv.gmv)}</div>
        <div style="margin-top:6px;">${statusTag("已导入")}</div>
      </div>` : "",
      topUnits ? `<div style="padding:12px;background:#f0fdf4;border-radius:8px;border-left:3px solid #10b981;">
        <div style="font-weight:600;color:#166534;margin-bottom:3px;">📦 成交件数最高链接 · ${escapeHtml(topUnits.id)}</div>
        <div style="font-size:12px;color:#15803d;">${escapeHtml(topUnits.name)} · ${escapeHtml(topUnits.store)} · ${formatNumber(topUnits.units, 0)} 件</div>
        <div style="margin-top:6px;">${statusTag("已导入")}</div>
      </div>` : "",
      `<div style="padding:12px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;">
        <div style="font-weight:600;color:#92400e;margin-bottom:3px;">⏳ GMV / CVR 对比排行</div>
        <div style="font-size:12px;color:#a16207;">当前文件只有单周期商品清单，上一周期数据尚未导入，暂不判断上涨或下降。</div>
        <div style="margin-top:6px;">${statusTag("待导入上一周期")}</div>
      </div>`,
    ].filter(Boolean).join("");
  }

  function rankingItems(mode) {
    const products = productsInScope();
    if (mode === "sales") return products.sort((left, right) => (right.units ?? 0) - (left.units ?? 0)).slice(0, 5);
    if (mode === "gmv") return products.sort((left, right) => (right.gmv ?? 0) - (left.gmv ?? 0)).slice(0, 5);
    return [];
  }

  function renderRankingCard(config) {
    const items = rankingItems(config.mode);
    const body = items.length ? items.map((product, index) => {
      const value = config.mode === "sales" ? `${formatNumber(product.units, 0)} 件` : formatMoney(product.gmv);
      return `<div class="real-ranking-item" title="${escapeHtml(product.name)}">
        <span class="real-ranking-rank">${index + 1}</span>
        <span class="real-ranking-name">${escapeHtml(product.name)} · ${escapeHtml(product.store)}</span>
        <span class="real-ranking-value">${value}</span>
      </div>`;
    }).join("") : `<div class="real-ranking-empty">当前导入文件没有上一周期数据，暂不生成该对比排行。</div>`;
    return `<div class="real-ranking-card ${config.className}">
      <div class="real-ranking-title">${config.icon} ${config.title}</div>
      <div class="real-ranking-subtitle">${config.subtitle}</div>
      ${body}
    </div>`;
  }

  function renderOverviewRankings() {
    const grid = document.getElementById("overview-ranking-grid");
    if (!grid) return;
    grid.innerHTML = [
      renderRankingCard({ mode: "sales", className: "", icon: "📊", title: "销量 Top5", subtitle: "按商品成交件数降序" }),
      renderRankingCard({ mode: "gmv", className: "gmv", icon: "💰", title: "全店 GMV Top5", subtitle: "按商品链接 GMV 降序" }),
      renderRankingCard({ mode: "up", className: "up", icon: "📈", title: "GMV 上涨 Top5", subtitle: "需要上一周期 GMV" }),
      renderRankingCard({ mode: "down", className: "down", icon: "📉", title: "GMV 下降 Top5", subtitle: "需要上一周期 GMV" }),
      renderRankingCard({ mode: "cvrDown", className: "cvr", icon: "⚠️", title: "CVR 下降 Top5", subtitle: "需要上一周期 CVR" }),
    ].join("");
  }

  function renderDataSummary() {
    const container = document.getElementById("real-data-summary");
    if (!container) return;
    const totals = totalsInScope();
    const storeRows = storesInScope().map((store) => {
      const storeTotals = store.totals;
      return `<tr><td><strong>${escapeHtml(store.name)}</strong></td><td>${store.reportDate}</td><td>${formatNumber(store.productCount, 0)}</td><td>${formatMoney(storeTotals.gmv)}</td><td>${formatNumber(storeTotals.orders, 0)}</td><td>${formatCompact(storeTotals.exposure)}</td><td>${formatPercent(storeTotals.cvr)}</td><td><span class="real-data-status">已导入</span></td></tr>`;
    }).join("");
    const topProducts = productsInScope().sort((left, right) => (right.gmv ?? 0) - (left.gmv ?? 0)).slice(0, 12);
    const productRows = topProducts.map((product) => `<tr>
      <td>${escapeHtml(product.store)}</td><td>${escapeHtml(product.id)}</td><td><span class="long-text" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</span></td>
      <td>${formatNumber(product.units, 0)}</td><td>${formatMoney(product.gmv)}</td><td>${formatNumber(product.orders, 0)}</td><td>${formatCompact(product.exposure)}</td><td>${formatPercent(product.ctor)}</td><td>${statusTag("已导入")}</td>
    </tr>`).join("");
    container.innerHTML = `<div class="card real-data-card">
      <div class="card-title">✅ 已导入真实店铺数据 <span>${escapeHtml(scopeLabel())} · ${escapeHtml(reportDateLabel())}</span></div>
      <div class="desktop-table-wrap"><table class="desktop-table"><thead><tr><th>店铺</th><th>报表日期</th><th>商品数</th><th>GMV</th><th>订单数</th><th>曝光</th><th>成交转化率</th><th>状态</th></tr></thead><tbody>${storeRows}</tbody></table></div>
      <div class="real-data-note">以下金额沿用原始文件币种：THB（฿）。当前 5 份文件都是单周期 product_list 快照；GMV 上涨、GMV 下降、CVR 下降需要再导入上一周期文件后才会生成，不会用猜测值补齐。</div>
    </div>
    <div class="card real-data-card">
      <div class="card-title">📦 商品经营明细 Top12 <span>${formatNumber(totals.productCount, 0)} 个商品中按 GMV 排序</span></div>
      <div class="desktop-table-wrap"><table class="desktop-table real-product-table"><thead><tr><th>店铺</th><th>商品 ID</th><th>商品名称</th><th>成交件数</th><th>GMV</th><th>订单数</th><th>曝光</th><th>CVR</th><th>状态</th></tr></thead><tbody>${productRows}</tbody></table></div>
    </div>`;
  }

  function updateDataSourceStatus() {
    const page = document.getElementById("page-data");
    if (!page) return;
    const sourceRow = page.querySelector(".desktop-table tbody tr");
    if (sourceRow) {
      const statusCell = sourceRow.lastElementChild;
      if (statusCell) statusCell.innerHTML = '<span class="tag tag-green">已导入真实数据</span>';
    }
    const uploadDescription = page.querySelector(".upload-zone-desc");
    if (uploadDescription) uploadDescription.textContent = "已导入 5 个真实店铺 product_list 文件；切换顶部店铺查看对应汇总。";
  }

  function renderAll() {
    updateContextBar();
    updateOverviewStats();
    renderPriorityPanel();
    renderOverviewRankings();
    renderDataSummary();
    updateDataSourceStatus();
  }

  function bindStoreFilter() {
    const select = document.getElementById("store-filter");
    if (!select) return;
    select.value = selectedStore;
    select.addEventListener("change", function () {
      selectedStore = this.value;
      renderAll();
    });
  }

  bindStoreFilter();
  renderAll();
})();
