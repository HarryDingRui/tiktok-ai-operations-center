(function () {
  "use strict";

  const sourceData = window.REAL_STORE_DATA;
  if (!sourceData || !Array.isArray(sourceData.stores)) return;

  let currentData = normalizeData(sourceData);
  let selectedStore = "all";
  let selectedDatePreset = "all";
  let customStartDate = "";
  let customEndDate = "";
  let xlsxLibraryPromise = null;
  let xlsxApi = null;

  const STORAGE_KEY = "tiktok-real-store-data-v2";
  const LEGACY_STORAGE_KEY = "tiktok-real-store-data-v1";

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
      for (const key of ["gmv", "orders", "skuOrders", "units", "customers", "exposure", "clicks", "addToCart"]) accumulator[key] += product[key] ?? 0;
      return accumulator;
    }, { gmv: 0, orders: 0, skuOrders: 0, units: 0, customers: 0, exposure: 0, clicks: 0, addToCart: 0 });
    totals.ctr = totals.exposure ? totals.clicks / totals.exposure * 100 : null;
    totals.cvr = totals.clicks ? totals.orders / totals.clicks * 100 : null;
    totals.avgOrderValue = totals.skuOrders ? totals.gmv / totals.skuOrders : null;
    totals.addToCartRate = totals.clicks ? totals.addToCart / totals.clicks * 100 : null;
    totals.ctor = totals.clicks ? totals.skuOrders / totals.clicks * 100 : null;
    totals.productCount = products.length;
    return totals;
  }

  function normalizeSnapshot(snapshot, fallbackDate, fallbackFile) {
    const products = Array.isArray(snapshot.products) ? snapshot.products : [];
    return {
      ...snapshot,
      reportDate: snapshot.reportDate || fallbackDate || "待确认",
      sourceFile: snapshot.sourceFile || fallbackFile || "",
      productCount: snapshot.productCount ?? products.length,
      totals: snapshot.totals || summarizeProducts(products),
      products,
    };
  }

  function normalizeStore(store) {
    const snapshots = Array.isArray(store.snapshots) && store.snapshots.length
      ? store.snapshots.map((snapshot) => normalizeSnapshot(snapshot, store.reportDate, store.sourceFile))
      : [normalizeSnapshot(store, store.reportDate, store.sourceFile)];
    return { name: store.name, snapshots };
  }

  function normalizeData(data) {
    return { ...data, version: 2, stores: data.stores.map(normalizeStore) };
  }

  function loadSavedData() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.stores)) currentData = normalizeData(parsed);
    } catch (error) {
      console.warn("Unable to restore local store data", error);
    }
  }

  function saveCurrentData() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
    } catch (error) {
      console.warn("Unable to save local store data", error);
    }
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
          resolve({
            reportDate: parseDateFromFilename(file.name),
            sourceFile: file.name,
            productCount: products.length,
            totals: summarizeProducts(products),
            products,
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsArrayBuffer(file);
    });
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

  function isDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  }

  function addDays(dateKey, days) {
    const date = new Date(`${dateKey}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function storesForDateAnchor() {
    return selectedStore === "all" ? currentData.stores : currentData.stores.filter((store) => store.name === selectedStore);
  }

  function availableDateKeys() {
    return [...new Set(storesForDateAnchor().flatMap((store) => store.snapshots.map((snapshot) => snapshot.reportDate)).filter(isDateKey))].sort();
  }

  function dateBounds() {
    const dates = availableDateKeys();
    return { min: dates[0] || "", max: dates[dates.length - 1] || "" };
  }

  function selectedDateBounds() {
    const available = dateBounds();
    if (!available.min) return { start: "", end: "" };
    if (selectedDatePreset === "7" || selectedDatePreset === "14") {
      const days = Number(selectedDatePreset);
      return { start: addDays(available.max, -(days - 1)), end: available.max };
    }
    if (selectedDatePreset === "custom") {
      const start = isDateKey(customStartDate) ? customStartDate : available.min;
      const end = isDateKey(customEndDate) ? customEndDate : available.max;
      return start <= end ? { start, end } : { start: end, end: start };
    }
    return { start: available.min, end: available.max };
  }

  function dateRangeLabel() {
    const bounds = selectedDateBounds();
    if (!bounds.start) return "暂无可用日期";
    const availableCount = availableDateKeys().filter((date) => date >= bounds.start && date <= bounds.end).length;
    return `${bounds.start} 至 ${bounds.end} · 可用 ${availableCount} 天`;
  }

  function snapshotsInRange(store) {
    const bounds = selectedDateBounds();
    return store.snapshots
      .filter((snapshot) => isDateKey(snapshot.reportDate) && snapshot.reportDate >= bounds.start && snapshot.reportDate <= bounds.end)
      .sort((left, right) => left.reportDate.localeCompare(right.reportDate));
  }

  function storesInScope() {
    const stores = selectedStore === "all" ? currentData.stores : currentData.stores.filter((store) => store.name === selectedStore);
    return stores.filter((store) => snapshotsInRange(store).length > 0);
  }

  function latestSnapshot(store) {
    const snapshots = snapshotsInRange(store);
    return snapshots[snapshots.length - 1];
  }

  function productsInScope() {
    return storesInScope().flatMap((store) => {
      const snapshot = latestSnapshot(store);
      return snapshot.products.map((product) => ({ ...product, store: store.name, reportDate: snapshot.reportDate }));
    });
  }

  function totalsInScope() {
    const products = productsInScope();
    const totals = products.reduce((accumulator, product) => {
      for (const key of ["gmv", "orders", "skuOrders", "units", "customers", "exposure", "clicks", "addToCart"]) accumulator[key] += product[key] ?? 0;
      return accumulator;
    }, { gmv: 0, orders: 0, skuOrders: 0, units: 0, customers: 0, exposure: 0, clicks: 0, addToCart: 0 });
    totals.productCount = products.length;
    totals.ctr = totals.exposure ? totals.clicks / totals.exposure * 100 : null;
    totals.cvr = totals.clicks ? totals.orders / totals.clicks * 100 : null;
    totals.avgOrderValue = totals.skuOrders ? totals.gmv / totals.skuOrders : null;
    totals.addToCartRate = totals.clicks ? totals.addToCart / totals.clicks * 100 : null;
    totals.ctor = totals.clicks ? totals.skuOrders / totals.clicks * 100 : null;
    return totals;
  }

  function scopeLabel() {
    return selectedStore === "all" ? "全部店铺" : selectedStore;
  }

  function currentSnapshotDateLabel() {
    const dates = [...new Set(storesInScope().map((store) => latestSnapshot(store)?.reportDate).filter(Boolean))].sort();
    return dates.length === 1 ? dates[0] : (dates.length ? `${dates[0]} 至 ${dates[dates.length - 1]}` : "待导入");
  }

  function statusTag(status) {
    const className = status === "已导入" ? "tag-blue" : status === "可售" ? "tag-green" : "tag-yellow";
    return `<span class="tag ${className}">${escapeHtml(status)}</span>`;
  }

  function updateContextBar() {
    const summary = document.getElementById("data-context-summary");
    if (!summary) return;
    summary.textContent = `${storesInScope().length} 个店铺 · ${formatNumber(totalsInScope().productCount, 0)} 个商品 · 时间范围 ${dateRangeLabel()}`;
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
      `${scope} · 区间内最新可用快照 ${currentSnapshotDateLabel()}`,
      `${scope} · 区间内最新可用快照合计`,
      `${scope} · 区间内最新可用快照`,
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
      if (description) description.innerHTML = `${scope} 当前最新商品记录<br><span style="color:#64748b;font-weight:600;">${escapeHtml(dateRangeLabel())}</span>`;
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
        <div style="font-weight:600;color:#92400e;margin-bottom:3px;">⏱️ 当前查看范围</div>
        <div style="font-size:12px;color:#a16207;">${escapeHtml(dateRangeLabel())}；指标按每个店铺区间内最新快照汇总。</div>
        <div style="margin-top:6px;">${statusTag("真实数据")}</div>
      </div>`,
    ].filter(Boolean).join("");
  }

  function comparisonItems() {
    return storesInScope().flatMap((store) => {
      const snapshots = snapshotsInRange(store);
      if (snapshots.length < 2 || snapshots[0].reportDate === snapshots[snapshots.length - 1].reportDate) return [];
      const baseline = new Map(snapshots[0].products.map((product) => [product.id, product]));
      const current = snapshots[snapshots.length - 1];
      return current.products.map((product) => {
        const previous = baseline.get(product.id);
        if (!previous) return null;
        const currentCvr = product.ctor ?? product.uniqueClickCvr;
        const previousCvr = previous.ctor ?? previous.uniqueClickCvr;
        const gmvChange = product.gmv != null && previous.gmv != null ? product.gmv - previous.gmv : null;
        const gmvChangePct = gmvChange != null && previous.gmv ? gmvChange / previous.gmv * 100 : null;
        const cvrChangePp = currentCvr != null && previousCvr != null ? currentCvr - previousCvr : null;
        return { ...product, store: store.name, reportDate: current.reportDate, baselineDate: snapshots[0].reportDate, gmvChange, gmvChangePct, cvrChangePp };
      }).filter(Boolean);
    });
  }

  function rankingItems(mode) {
    const products = productsInScope();
    if (mode === "sales") return products.sort((left, right) => (right.units ?? 0) - (left.units ?? 0)).slice(0, 5);
    if (mode === "gmv") return products.sort((left, right) => (right.gmv ?? 0) - (left.gmv ?? 0)).slice(0, 5);
    const comparisons = comparisonItems();
    if (mode === "up") return comparisons.filter((product) => product.gmvChangePct > 0).sort((left, right) => right.gmvChangePct - left.gmvChangePct).slice(0, 5);
    if (mode === "down") return comparisons.filter((product) => product.gmvChangePct < 0).sort((left, right) => left.gmvChangePct - right.gmvChangePct).slice(0, 5);
    if (mode === "cvrDown") return comparisons.filter((product) => product.cvrChangePp < 0).sort((left, right) => left.cvrChangePp - right.cvrChangePp).slice(0, 5);
    return [];
  }

  function renderRankingCard(config) {
    const items = rankingItems(config.mode);
    const body = items.length ? items.map((product, index) => {
      let value = config.mode === "sales" ? `${formatNumber(product.units, 0)} 件` : formatMoney(product.gmv);
      if (config.mode === "up" || config.mode === "down") value = `${product.gmvChangePct > 0 ? "+" : ""}${product.gmvChangePct.toFixed(1)}%`;
      if (config.mode === "cvrDown") value = `${product.cvrChangePp.toFixed(2)} 个百分点`;
      return `<div class="real-ranking-item" title="${escapeHtml(product.name)}">
        <span class="real-ranking-rank">${index + 1}</span>
        <span class="real-ranking-name">${escapeHtml(product.name)} · ${escapeHtml(product.store)}</span>
        <span class="real-ranking-value">${value}</span>
      </div>`;
    }).join("") : `<div class="real-ranking-empty">${config.mode === "sales" || config.mode === "gmv" ? "当前范围暂无真实商品数据。" : "需要同一店铺在当前范围内至少有两个日期快照，才生成真实对比。"}</div>`;
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
      renderRankingCard({ mode: "sales", className: "", icon: "📊", title: "销量 Top5", subtitle: "按区间内最新快照成交件数" }),
      renderRankingCard({ mode: "gmv", className: "gmv", icon: "💰", title: "全店 GMV Top5", subtitle: "按区间内最新快照 GMV" }),
      renderRankingCard({ mode: "up", className: "up", icon: "📈", title: "GMV 上涨 Top5", subtitle: "当前范围首个快照 → 最新快照" }),
      renderRankingCard({ mode: "down", className: "down", icon: "📉", title: "GMV 下降 Top5", subtitle: "当前范围首个快照 → 最新快照" }),
      renderRankingCard({ mode: "cvrDown", className: "cvr", icon: "⚠️", title: "CVR 下降 Top5", subtitle: "按区间首尾快照变化" }),
    ].join("");
  }

  function renderDataSummary() {
    const container = document.getElementById("real-data-summary");
    if (!container) return;
    const totals = totalsInScope();
    const scopedStores = storesInScope();
    const storeRows = scopedStores.map((store) => {
      const snapshot = latestSnapshot(store);
      const storeTotals = snapshot.totals;
      return `<tr><td><strong>${escapeHtml(store.name)}</strong></td><td>${snapshot.reportDate}</td><td>${formatNumber(snapshot.productCount, 0)}</td><td>${formatMoney(storeTotals.gmv)}</td><td>${formatNumber(storeTotals.orders, 0)}</td><td>${formatCompact(storeTotals.exposure)}</td><td>${formatPercent(storeTotals.cvr)}</td><td><span class="real-data-status">已导入</span></td></tr>`;
    }).join("") || `<tr><td colspan="8" class="real-ranking-empty">当前日期范围暂无匹配的真实快照。</td></tr>`;
    const topProducts = productsInScope().sort((left, right) => (right.gmv ?? 0) - (left.gmv ?? 0)).slice(0, 12);
    const productRows = topProducts.map((product) => `<tr>
      <td>${escapeHtml(product.store)}</td><td>${escapeHtml(product.id)}</td><td><span class="long-text" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</span></td>
      <td>${formatNumber(product.units, 0)}</td><td>${formatMoney(product.gmv)}</td><td>${formatNumber(product.orders, 0)}</td><td>${formatNumber(product.skuOrders, 0)}</td><td>${formatNumber(product.customers, 0)}</td><td>${formatMoney(product.avgOrderValue)}</td><td>${formatCompact(product.exposure)}</td><td>${formatNumber(product.clicks, 0)}</td><td>${formatPercent(product.ctr)}</td><td>${formatNumber(product.addToCart, 0)}</td><td>${formatPercent(product.addToCartRate)}</td><td>${formatPercent(product.ctor)}</td><td>${formatPercent(product.uniqueClickCvr)}</td><td>${statusTag("已导入")}</td>
    </tr>`).join("") || `<tr><td colspan="17" class="real-ranking-empty">当前日期范围暂无商品明细。</td></tr>`;
    const fieldCards = [
      ["SKU订单数", formatNumber(totals.skuOrders, 0)], ["商品成交件数", formatNumber(totals.units, 0)],
      ["预计客户数", formatNumber(totals.customers, 0)], ["平均订单金额", formatMoney(totals.avgOrderValue)],
      ["商品点击量", formatNumber(totals.clicks, 0)], ["商品点击率", formatPercent(totals.ctr)],
      ["加购次数", formatNumber(totals.addToCart, 0)], ["加购率", formatPercent(totals.addToCartRate)],
      ["CTOR", formatPercent(totals.ctor)],
    ].map(([label, value]) => `<div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;"><div style="font-size:12px;color:#64748b;">${label}</div><div style="margin-top:5px;font-size:18px;font-weight:700;color:#0f172a;">${value}</div></div>`).join("");
    container.innerHTML = `<div class="card real-data-card">
      <div class="card-title">✅ 已导入真实店铺数据 <span>${escapeHtml(scopeLabel())} · ${escapeHtml(dateRangeLabel())}</span></div>
      <div class="desktop-table-wrap"><table class="desktop-table"><thead><tr><th>店铺</th><th>最新快照</th><th>商品数</th><th>GMV</th><th>订单数</th><th>曝光</th><th>成交转化率</th><th>状态</th></tr></thead><tbody>${storeRows}</tbody></table></div>
      <div class="real-data-note">当前页面按每个店铺在所选日期范围内的最新可用快照汇总，避免把快照重复相加；GMV 上涨/下降和 CVR 下降按范围内首个与最新快照、同一店铺同一商品 ID 匹配计算。范围内只有一个日期时，不生成趋势结论。</div>
    </div>
    <div class="card real-data-card">
      <div class="card-title">📌 product_list 字段速览 <span>${escapeHtml(scopeLabel())} · 当前范围最新可用快照</span></div>
      <div class="real-field-grid">${fieldCards}</div>
    </div>
    <div class="card real-data-card">
      <div class="card-title">📦 商品经营明细 Top12 <span>${formatNumber(totals.productCount, 0)} 个最新商品记录中按 GMV 排序</span></div>
      <div class="desktop-table-wrap"><table class="desktop-table real-product-table"><thead><tr><th>店铺</th><th>商品 ID</th><th>商品名称</th><th>成交件数</th><th>GMV</th><th>订单数</th><th>SKU订单数</th><th>预计客户</th><th>均单金额</th><th>曝光</th><th>点击量</th><th>CTR</th><th>加购次数</th><th>加购率</th><th>CTOR</th><th>去重点击CVR</th><th>状态</th></tr></thead><tbody>${productRows}</tbody></table></div>
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
    if (uploadDescription) uploadDescription.textContent = `支持多选；当前保存 ${currentData.stores.length} 个店铺、${currentData.stores.reduce((sum, store) => sum + store.snapshots.length, 0)} 个日期快照。文件名格式：店铺名：xxx-product_list_YYYYMMDD.xlsx`;
  }

  function updateDateControls() {
    const preset = document.getElementById("date-range-preset");
    const customRange = document.getElementById("custom-date-range");
    const startInput = document.getElementById("date-range-start");
    const endInput = document.getElementById("date-range-end");
    const bounds = dateBounds();
    if (preset) preset.value = selectedDatePreset;
    if (customRange) customRange.classList.toggle("is-visible", selectedDatePreset === "custom");
    if (startInput) {
      startInput.min = bounds.min;
      startInput.max = bounds.max;
      startInput.value = customStartDate || bounds.min;
    }
    if (endInput) {
      endInput.min = bounds.min;
      endInput.max = bounds.max;
      endInput.value = customEndDate || bounds.max;
    }
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
      const importedSnapshots = await Promise.all(files.map(parseProductListFile));
      const invalidDate = importedSnapshots.find((snapshot) => !isDateKey(snapshot.reportDate));
      if (invalidDate) throw new Error(`${invalidDate.sourceFile} 缺少 YYYYMMDD 日期，无法进入时间筛选`);
      const storeMap = new Map(currentData.stores.map((store) => [store.name, normalizeStore(store)]));
      importedSnapshots.forEach((snapshot) => {
        const storeName = parseStoreFromFilename(snapshot.sourceFile);
        const store = storeMap.get(storeName) || { name: storeName, snapshots: [] };
        store.snapshots = [...store.snapshots.filter((item) => item.reportDate !== snapshot.reportDate), snapshot]
          .sort((left, right) => left.reportDate.localeCompare(right.reportDate));
        storeMap.set(storeName, store);
      });
      currentData = { ...currentData, version: 2, importedAt: new Date().toISOString().slice(0, 10), stores: [...storeMap.values()] };
      saveCurrentData();
      selectedStore = "all";
      selectedDatePreset = "all";
      customStartDate = "";
      customEndDate = "";
      renderAll();
      updateUploadStatus(`已导入 ${importedSnapshots.length} 个文件 · ${importedSnapshots.reduce((sum, snapshot) => sum + snapshot.productCount, 0)} 条商品`);
      window.alert(`✅ 数据导入完成\n\n${importedSnapshots.map((snapshot) => `${parseStoreFromFilename(snapshot.sourceFile)} · ${snapshot.reportDate}：${snapshot.productCount} 条商品`).join("\n")}\n\n历史快照已按店铺和日期保存。`);
    } catch (error) {
      updateUploadStatus("导入失败，请检查文件格式", "error");
      window.alert(`❌ 导入失败\n\n${error.message || "无法识别该文件"}`);
    } finally {
      event.target.value = "";
    }
  }

  function bindFilters() {
    const storeSelect = document.getElementById("store-filter");
    if (storeSelect) storeSelect.addEventListener("change", function () {
      selectedStore = this.value;
      renderAll();
    });
    const preset = document.getElementById("date-range-preset");
    if (preset) preset.addEventListener("change", function () {
      selectedDatePreset = this.value;
      renderAll();
    });
    const startInput = document.getElementById("date-range-start");
    const endInput = document.getElementById("date-range-end");
    if (startInput) startInput.addEventListener("change", function () { customStartDate = this.value; selectedDatePreset = "custom"; renderAll(); });
    if (endInput) endInput.addEventListener("change", function () { customEndDate = this.value; selectedDatePreset = "custom"; renderAll(); });
  }

  function renderStoreOptions() {
    const select = document.getElementById("store-filter");
    if (!select) return;
    const availableNames = new Set(currentData.stores.map((store) => store.name));
    if (selectedStore !== "all" && !availableNames.has(selectedStore)) selectedStore = "all";
    select.innerHTML = ['<option value="all">全部店铺</option>', ...currentData.stores.map((store) => `<option value="${escapeHtml(store.name)}">${escapeHtml(store.name)}</option>`)].join("");
    select.value = selectedStore;
  }

  function renderAll() {
    updateDateControls();
    renderStoreOptions();
    updateContextBar();
    updateOverviewStats();
    renderPriorityPanel();
    renderOverviewRankings();
    renderDataSummary();
    updateDataSourceStatus();
  }

  loadSavedData();
  bindFilters();
  const fileInput = document.getElementById("real-store-file-input");
  if (fileInput) fileInput.addEventListener("change", handleFileImport);
  renderAll();
})();
