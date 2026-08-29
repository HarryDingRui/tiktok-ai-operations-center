(function () {
  "use strict";

  let currentData = window.REAL_STORE_DATA;
  if (!currentData || !Array.isArray(currentData.stores)) return;

  let selectedStore = "all";
  let xlsxLibraryPromise = null;
  let xlsxApi = null;

  const STORAGE_KEY = "tiktok-real-store-data-v1";

  function loadSavedData() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.stores)) currentData = parsed;
    } catch (error) {
      console.warn("Unable to restore local store data", error);
    }
  }

  function parseNumber(value) {
    if (value == null || value === "") return null;
    const normalized = String(value).replace(/[฿$¥,%\s,]/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function parseDateFromFilename(fileName) {
    const match = String(fileName).match(/product_list_(\d{8})/i);
    if (!match) return "待确认";
    return `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`;
  }

  function parseStoreFromFilename(fileName) {
    const match = String(fileName).match(/^店铺名[:：](.+?)-product_list_\d{8}\.(?:xlsx|xls)$/i);
    if (match) return match[1].trim();
    return String(fileName).replace(/\.(?:xlsx|xls)$/i, "").trim();
  }

  function headerIndex(headers, names) {
    const candidates = Array.isArray(names) ? names : [names];
    return candidates.map((name) => headers.indexOf(name)).find((index) => index >= 0);
  }

  function summarizeProducts(products) {
    const totals = products.reduce((accumulator, product) => {
      for (const key of ["gmv", "orders", "units", "exposure", "clicks", "addToCart"]) accumulator[key] += product[key] ?? 0;
      return accumulator;
    }, { gmv: 0, orders: 0, units: 0, exposure: 0, clicks: 0, addToCart: 0 });
    totals.ctr = totals.exposure ? totals.clicks / totals.exposure * 100 : null;
    totals.cvr = totals.clicks ? totals.orders / totals.clicks * 100 : null;
    totals.productCount = products.length;
    return totals;
  }

  function parseProductListFile(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = () => {
        try {
          const workbook = xlsxApi.read(reader.result, { type: "array", cellText: true, cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = xlsxApi.utils.sheet_to_json(firstSheet, { header: 1, defval: null, raw: false });
          const headerRowIndex = rows.findIndex((row) => row.some((cell) => cell === "商品 ID") && row.some((cell) => cell === "商品名"));
          if (headerRowIndex < 0) throw new Error("未找到“商品名 / 商品 ID”表头");
          const headers = rows[headerRowIndex].map((cell) => String(cell ?? "").trim());
          const columns = {
            name: headerIndex(headers, "商品名"), id: headerIndex(headers, "商品 ID"), status: headerIndex(headers, "发品状态"),
            gmv: headerIndex(headers, "GMV"), orders: headerIndex(headers, "订单数"), skuOrders: headerIndex(headers, "SKU 订单数"),
            units: headerIndex(headers, "商品成交件数"), customers: headerIndex(headers, "预计客户数"), avgOrderValue: headerIndex(headers, "平均订单金额（SKU 订单）"),
            exposure: headerIndex(headers, "商品曝光次数"), clicks: headerIndex(headers, "商品点击量"), ctr: headerIndex(headers, "商品点击率"),
            addToCart: headerIndex(headers, "加购次数"), addToCartRate: headerIndex(headers, "加购率"), ctor: headerIndex(headers, "CTOR（SKU 订单）"),
            uniqueClickCvr: headerIndex(headers, "去重点击成交转化率（SKU 订单）"),
          };
          const products = rows.slice(headerRowIndex + 1).map((row) => ({
            id: row[columns.id] == null ? "" : String(row[columns.id]).trim(),
            name: row[columns.name] == null ? "" : String(row[columns.name]).trim(),
            status: row[columns.status] == null ? "" : String(row[columns.status]),
            gmv: parseNumber(row[columns.gmv]), orders: parseNumber(row[columns.orders]), skuOrders: parseNumber(row[columns.skuOrders]),
            units: parseNumber(row[columns.units]), customers: parseNumber(row[columns.customers]), avgOrderValue: parseNumber(row[columns.avgOrderValue]),
            exposure: parseNumber(row[columns.exposure]), clicks: parseNumber(row[columns.clicks]), ctr: parseNumber(row[columns.ctr]),
            addToCart: parseNumber(row[columns.addToCart]), addToCartRate: parseNumber(row[columns.addToCartRate]), ctor: parseNumber(row[columns.ctor]),
            uniqueClickCvr: parseNumber(row[columns.uniqueClickCvr]),
          })).filter((product) => product.id && product.name);
          if (!products.length) throw new Error("文件中没有可识别的商品记录");
          resolve({ name: parseStoreFromFilename(file.name), reportDate: parseDateFromFilename(file.name), sourceFile: file.name, productCount: products.length, totals: summarizeProducts(products), products });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsArrayBuffer(file);
    });
  }

  function saveCurrentData() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
    } catch (error) {
      console.warn("Unable to save local store data", error);
    }
  }

  function ensureXlsxLibrary() {
    if (xlsxApi) return Promise.resolve(xlsxApi);
    if (window.XLSX) {
      xlsxApi = window.XLSX;
      return Promise.resolve(xlsxApi);
    }
    if (xlsxLibraryPromise) return xlsxLibraryPromise;
    xlsxLibraryPromise = new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.title = "Excel parser";
      frame.style.display = "none";
      frame.src = "./data/xlsx-loader.html?loader=1";
      frame.onload = () => {
        xlsxApi = frame.contentWindow && frame.contentWindow.XLSX;
        if (xlsxApi) resolve(xlsxApi);
        else reject(new Error("Excel 解析组件未加载"));
      };
      frame.onerror = () => reject(new Error("Excel 解析组件加载失败"));
      document.body.appendChild(frame);
    });
    return xlsxLibraryPromise;
  }

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
    return selectedStore === "all" ? currentData.stores : currentData.stores.filter((store) => store.name === selectedStore);
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
    renderStoreOptions();
    updateContextBar();
    updateOverviewStats();
    renderPriorityPanel();
    renderOverviewRankings();
    renderDataSummary();
    updateDataSourceStatus();
  }

  function renderStoreOptions() {
    const select = document.getElementById("store-filter");
    if (!select) return;
    const availableNames = new Set(currentData.stores.map((store) => store.name));
    if (selectedStore !== "all" && !availableNames.has(selectedStore)) selectedStore = "all";
    select.innerHTML = ['<option value="all">全部店铺</option>', ...currentData.stores.map((store) => `<option value="${escapeHtml(store.name)}">${escapeHtml(store.name)}</option>`)].join("");
    select.value = selectedStore;
  }

  function updateUploadStatus(message, kind = "success") {
    const status = document.getElementById("real-data-upload-status");
    if (!status) return;
    status.className = `tag ${kind === "error" ? "tag-red" : "tag-green"}`;
    status.textContent = message;
  }

  async function handleFileImport(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    updateUploadStatus(`正在解析 ${files.length} 个文件…`);
    try {
      await ensureXlsxLibrary();
      const importedStores = await Promise.all(files.map(parseProductListFile));
      const storeMap = new Map(currentData.stores.map((store) => [store.name, store]));
      importedStores.forEach((store) => storeMap.set(store.name, store));
      currentData = { ...currentData, importedAt: new Date().toISOString().slice(0, 10), stores: [...storeMap.values()] };
      saveCurrentData();
      selectedStore = "all";
      renderAll();
      updateUploadStatus(`已导入 ${importedStores.length} 个文件 · ${importedStores.reduce((sum, store) => sum + store.productCount, 0)} 条商品`);
      window.alert(`✅ 数据导入完成\n\n${importedStores.map((store) => `${store.name}：${store.productCount} 条商品`).join("\n")}\n\n数据已保存在当前浏览器。`);
    } catch (error) {
      updateUploadStatus("导入失败，请检查文件格式", "error");
      window.alert(`❌ 导入失败\n\n${error.message || "无法识别该文件"}`);
    } finally {
      event.target.value = "";
    }
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

  loadSavedData();
  renderStoreOptions();
  bindStoreFilter();
  const fileInput = document.getElementById("real-store-file-input");
  if (fileInput) fileInput.addEventListener("change", handleFileImport);
  renderAll();
})();
