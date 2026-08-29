(function () {
  "use strict";

  const sourceData = window.REAL_STORE_DATA;
  if (!sourceData || !Array.isArray(sourceData.stores)) return;

  const SUMMARIZED_SOURCE_FIELDS = [
    "uniqueExposure", "uniqueClicks", "uniqueAtcUsers", "taxIncludedGmv", "tax", "tiktokJointGmv", "shipping",
    "refundAmount", "refundedUnits", "refundCustomers", "mallExposure", "mallClicks", "mallUniqueClicks", "mallCustomers",
    "mallGmv", "mallUnits", "attributedGmv", "indirectGmv", "attributedOrders", "attributedSkuOrders", "indirectSkuOrders",
    "attributedUnits", "indirectUnits", "attributedCustomers", "newLiveSessions", "newVideos", "avgDailyReach",
    "liveExposure", "liveClicks", "liveAddToCart", "liveUniqueExposure", "liveUniqueClicks", "liveAtcUsers",
    "videoExposure", "videoClicks", "videoAddToCart", "videoUniqueExposure", "videoUniqueClicks", "videoAtcUsers",
  ];
  const SUMMED_FIELDS = [
    "gmv", "orders", "skuOrders", "units", "customers", "exposure", "clicks", "addToCart",
    ...SUMMARIZED_SOURCE_FIELDS,
  ];

  let currentData = normalizeData(sourceData);
  let selectedStore = "all";
  let selectedDatePreset = "all";
  let customStartDate = "";
  let customEndDate = "";
  let xlsxLibraryPromise = null;
  let xlsxApi = null;

  const STORAGE_KEY = "tiktok-real-store-data-v2";
  const LEGACY_STORAGE_KEY = "tiktok-real-store-data-v1";
  const DATABASE_NAME = "tiktok-ai-operations-center";
  const DATABASE_VERSION = 1;
  const DATABASE_STORE = "datasets";
  const DATABASE_KEY = "real-store-data-v2";
  let databasePromise = null;

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

  function headerOccurrenceIndex(headers, name, occurrence = 0) {
    let matchCount = 0;
    for (let index = 0; index < headers.length; index += 1) {
      if (headers[index] !== name) continue;
      if (matchCount === occurrence) return index;
      matchCount += 1;
    }
    return -1;
  }

  function sourceValue(headers, values, name, occurrence = 0) {
    const index = headerOccurrenceIndex(headers, name, occurrence);
    return index >= 0 ? values[index] : null;
  }

  function sourceNumber(headers, values, name, occurrence = 0) {
    return parseNumber(sourceValue(headers, values, name, occurrence));
  }

  function hydrateProductFromSource(product, sourceHeaders) {
    if (!Array.isArray(sourceHeaders) || !Array.isArray(product.sourceValues)) return product;
    const values = product.sourceValues;
    const readNumber = (name, occurrence = 0) => sourceNumber(sourceHeaders, values, name, occurrence);
    const readText = (name, occurrence = 0) => {
      const value = sourceValue(sourceHeaders, values, name, occurrence);
      return value == null ? "" : String(value).trim();
    };
    return {
      ...product,
      status: readText("发品状态"),
      gmvRange: readText("GMV 区间"),
      gmv: readNumber("GMV", 0),
      orders: readNumber("订单数", 0),
      skuOrders: readNumber("SKU 订单数", 0),
      units: readNumber("商品成交件数", 0),
      customers: readNumber("预计客户数", 0),
      avgOrderValue: readNumber("平均订单金额（SKU 订单）", 0),
      exposure: readNumber("商品曝光次数", 0),
      clicks: readNumber("商品点击量", 0),
      ctr: readNumber("商品点击率", 0),
      addToCart: readNumber("加购次数", 0),
      addToCartRate: readNumber("加购率", 0),
      ctor: readNumber("CTOR（SKU 订单）", 0),
      uniqueExposure: readNumber("去重商品曝光次数", 0),
      uniqueClicks: readNumber("去重点击次数", 0),
      uniqueCtr: readNumber("去重点击率", 0),
      uniqueAtcUsers: readNumber("已加购的用户数", 0),
      uniqueAtcRate: readNumber("去重加购率", 0),
      uniqueClickCvr: readNumber("去重点击成交转化率（SKU 订单）", 0),
      taxIncludedGmv: readNumber("含税 GMV"), tax: readNumber("税费"),
      tiktokJointGmv: readNumber("GMV（TikTok 合资）"), shipping: readNumber("运费"),
      refundAmount: readNumber("退款金额"), refundedUnits: readNumber("已退款的商品件数"),
      refundCustomers: readNumber("退款客户数"),
      mallExposure: readNumber("商城页商品曝光次数"), mallClicks: readNumber("商城页商品点击量"),
      mallUniqueClicks: readNumber("商城页去重商品点击量"), mallCustomers: readNumber("预计商城页客户数"),
      mallCtr: readNumber("商城页点击率"), mallCvr: readNumber("商城页点击成交转化率（SKU 订单）"),
      mallGmv: readNumber("商城页 GMV"), mallUnits: readNumber("商城页商品成交件数"),
      attributedGmv: readNumber("归因 GMV", 0), indirectGmv: readNumber("间接 GMV", 0),
      attributedOrders: readNumber("归因订单数", 0), attributedSkuOrders: readNumber("归因 SKU 订单数", 0),
      indirectSkuOrders: readNumber("间接 SKU 订单数", 0), attributedUnits: readNumber("归因成交件数", 0),
      indirectUnits: readNumber("间接成交件数", 0), attributedCustomers: readNumber("预计客户数", 1),
      attributedAov: readNumber("AOV（归因 SKU 订单）", 0), newLiveSessions: readNumber("新直播场次", 0),
      newVideos: readNumber("新视频数", 0), avgDailyReach: readNumber("已发布内容的日均达人数"),
      liveExposure: readNumber("商品曝光次数（直播）"), liveClicks: readNumber("商品点击量（直播）"),
      liveCtr: readNumber("CTR（直播）"), liveAddToCart: readNumber("加购次数（直播）"),
      liveAddToCartRate: readNumber("加购率（直播）"), liveCtor: readNumber("CTOR（SKU 订单）（直播）"),
      liveUniqueExposure: readNumber("去重商品曝光次数（直播）"), liveUniqueClicks: readNumber("去重点击次数（直播）"),
      liveUniqueCtr: readNumber("去重点击率（直播）"), liveAtcUsers: readNumber("ATC 用户数（直播）"),
      liveUniqueAtcRate: readNumber("去重加购率（直播）"), liveUniqueClickCvr: readNumber("去重点击成交转化率（SKU 订单）（直播）"),
      videoExposure: readNumber("商品曝光次数（视频）"), videoClicks: readNumber("商品点击量（视频）"),
      videoCtr: readNumber("CTR（视频）"), videoAddToCart: readNumber("加购次数（视频）"),
      videoAddToCartRate: readNumber("加购率（视频）"), videoCtor: readNumber("CTOR（SKU 订单）（视频）"),
      videoUniqueExposure: readNumber("去重商品曝光次数（视频）"), videoUniqueClicks: readNumber("去重点击次数（视频）"),
      videoUniqueCtr: readNumber("去重点击率（视频）"), videoAtcUsers: readNumber("ATC 用户数（视频）"),
      videoUniqueAtcRate: readNumber("去重加购率（视频）"), videoUniqueClickCvr: readNumber("去重点击成交转化率（SKU 订单）（视频）"),
    };
  }

  function summarizeProducts(products) {
    const totals = Object.fromEntries(SUMMED_FIELDS.map((key) => [key, 0]));
    const availableCounts = Object.fromEntries(SUMMED_FIELDS.map((key) => [key, 0]));
    products.forEach((product) => {
      SUMMED_FIELDS.forEach((key) => {
        if (product[key] == null || !Number.isFinite(Number(product[key]))) return;
        totals[key] += Number(product[key]);
        availableCounts[key] += 1;
      });
    });
    SUMMED_FIELDS.forEach((key) => {
      if (!availableCounts[key]) totals[key] = null;
    });
    totals.ctr = totals.exposure ? totals.clicks / totals.exposure * 100 : null;
    totals.cvr = totals.clicks ? totals.orders / totals.clicks * 100 : null;
    totals.avgOrderValue = totals.skuOrders ? totals.gmv / totals.skuOrders : null;
    totals.addToCartRate = totals.clicks ? totals.addToCart / totals.clicks * 100 : null;
    totals.ctor = totals.clicks ? totals.skuOrders / totals.clicks * 100 : null;
    totals.uniqueCtr = totals.uniqueExposure ? totals.uniqueClicks / totals.uniqueExposure * 100 : null;
    totals.uniqueAtcRate = totals.uniqueClicks ? totals.uniqueAtcUsers / totals.uniqueClicks * 100 : null;
    totals.uniqueClickCvr = totals.uniqueClicks ? totals.skuOrders / totals.uniqueClicks * 100 : null;
    totals.attributedAov = totals.attributedSkuOrders ? totals.attributedGmv / totals.attributedSkuOrders : null;
    totals.liveCtr = totals.liveExposure ? totals.liveClicks / totals.liveExposure * 100 : null;
    totals.liveAddToCartRate = totals.liveClicks ? totals.liveAddToCart / totals.liveClicks * 100 : null;
    totals.liveUniqueCtr = totals.liveUniqueExposure ? totals.liveUniqueClicks / totals.liveUniqueExposure * 100 : null;
    totals.liveUniqueAtcRate = totals.liveUniqueClicks ? totals.liveAtcUsers / totals.liveUniqueClicks * 100 : null;
    totals.videoCtr = totals.videoExposure ? totals.videoClicks / totals.videoExposure * 100 : null;
    totals.videoAddToCartRate = totals.videoClicks ? totals.videoAddToCart / totals.videoClicks * 100 : null;
    totals.videoUniqueCtr = totals.videoUniqueExposure ? totals.videoUniqueClicks / totals.videoUniqueExposure * 100 : null;
    totals.videoUniqueAtcRate = totals.videoUniqueClicks ? totals.videoAtcUsers / totals.videoUniqueClicks * 100 : null;
    totals.productCount = products.length;
    return totals;
  }

  function normalizeSnapshot(snapshot, fallbackDate, fallbackFile) {
    const products = Array.isArray(snapshot.products) ? snapshot.products : [];
    const hydratedProducts = products.map((product) => hydrateProductFromSource(product, snapshot.sourceHeaders));
    return {
      ...snapshot,
      reportDate: snapshot.reportDate || fallbackDate || "待确认",
      sourceFile: snapshot.sourceFile || fallbackFile || "",
      productCount: snapshot.productCount ?? hydratedProducts.length,
      totals: hydratedProducts.length ? summarizeProducts(hydratedProducts) : (snapshot.totals || summarizeProducts([])),
      products: hydratedProducts,
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

  function openDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error("当前浏览器不支持大容量本地数据存储"));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DATABASE_STORE)) database.createObjectStore(DATABASE_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("无法打开本地数据存储"));
      request.onblocked = () => reject(new Error("本地数据存储正在被其他页面占用，请关闭旧页面后重试"));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
    return databasePromise;
  }

  async function readIndexedData() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DATABASE_STORE, "readonly");
      const request = transaction.objectStore(DATABASE_STORE).get(DATABASE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("无法读取本地历史快照"));
      transaction.onabort = () => reject(transaction.error || new Error("读取本地历史快照已中止"));
    });
  }

  async function writeIndexedData(data) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DATABASE_STORE, "readwrite");
      transaction.objectStore(DATABASE_STORE).put(data, DATABASE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("无法保存本地历史快照"));
      transaction.onabort = () => reject(transaction.error || new Error("保存本地历史快照已中止"));
    });
  }

  async function clearIndexedData() {
    if (!window.indexedDB) return;
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DATABASE_STORE, "readwrite");
      transaction.objectStore(DATABASE_STORE).delete(DATABASE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("无法清除本地历史快照"));
      transaction.onabort = () => reject(transaction.error || new Error("清除本地历史快照已中止"));
    });
  }

  function readLegacySavedData() {
    const saved = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed && Array.isArray(parsed.stores) ? parsed : null;
  }

  async function loadSavedData() {
    let savedData = null;
    try {
      savedData = await readIndexedData();
    } catch (error) {
      console.warn("Unable to read IndexedDB store data", error);
    }
    if (!savedData) {
      try {
        savedData = readLegacySavedData();
        if (savedData) {
          await writeIndexedData(savedData);
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      } catch (error) {
        console.warn("Unable to migrate legacy store data", error);
      }
    }
    if (!savedData || !Array.isArray(savedData.stores)) return false;
    currentData = normalizeData(savedData);
    return true;
  }

  async function saveCurrentData() {
    try {
      await writeIndexedData(currentData);
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (indexedError) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
      } catch (localStorageError) {
        const error = new Error("数据已解析，但浏览器存储空间不足，未能保存；请释放浏览器空间后重试");
        error.cause = localStorageError;
        throw error;
      }
      console.warn("IndexedDB unavailable; saved with localStorage fallback", indexedError);
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
          const headerRowIndex = rows.findIndex((row) => {
            const normalizedCells = row.map((cell) => String(cell ?? "").trim());
            return normalizedCells.includes("商品 ID") && normalizedCells.includes("商品名");
          });
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
          const products = rows.slice(headerRowIndex + 1).map((row) => hydrateProductFromSource({
            id: row[columns.id] == null ? "" : String(row[columns.id]).trim(),
            name: row[columns.name] == null ? "" : String(row[columns.name]).trim(),
            status: row[columns.status] == null ? "" : String(row[columns.status]),
            gmv: parseNumber(row[columns.gmv]), orders: parseNumber(row[columns.orders]), skuOrders: parseNumber(row[columns.skuOrders]),
            units: parseNumber(row[columns.units]), customers: parseNumber(row[columns.customers]), avgOrderValue: parseNumber(row[columns.avgOrderValue]),
            exposure: parseNumber(row[columns.exposure]), clicks: parseNumber(row[columns.clicks]), ctr: parseNumber(row[columns.ctr]),
            addToCart: parseNumber(row[columns.addToCart]), addToCartRate: parseNumber(row[columns.addToCartRate]), ctor: parseNumber(row[columns.ctor]),
            uniqueClickCvr: parseNumber(row[columns.uniqueClickCvr]),
            sourceValues: row.slice(0, headers.length),
          }, headers)).filter((product) => product.id && product.name);
          if (!products.length) throw new Error("文件中没有可识别的商品记录");
          resolve({
            reportDate: parseDateFromFilename(file.name),
            sourceFile: file.name,
            productCount: products.length,
            totals: summarizeProducts(products),
            sourceHeaders: headers,
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
        else {
          frame.remove();
          reject(new Error("Excel 解析组件未加载"));
        }
      };
      frame.onerror = () => {
        frame.remove();
        reject(new Error("Excel 解析组件加载失败"));
      };
      document.body.appendChild(frame);
    }).catch((error) => {
      xlsxLibraryPromise = null;
      throw error;
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
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function addDays(dateKey, days) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
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
      return snapshot.products.map((product) => ({ ...product, store: store.name, reportDate: snapshot.reportDate, sourceHeaders: snapshot.sourceHeaders || [] }));
    });
  }

  function totalsInScope() {
    return summarizeProducts(productsInScope());
  }

  function scopeLabel() {
    return selectedStore === "all" ? "全部店铺" : selectedStore;
  }

  function currentSnapshotDateLabel() {
    const dates = [...new Set(storesInScope().map((store) => latestSnapshot(store)?.reportDate).filter(Boolean))].sort();
    return dates.length === 1 ? dates[0] : (dates.length ? `${dates[0]} 至 ${dates[dates.length - 1]}` : "待导入");
  }

  function statusTag(status) {
    const className = status === "已导入" ? "tag-blue" : (status === "可售" || status === "真实数据") ? "tag-green" : "tag-yellow";
    return `<span class="tag ${className}">${escapeHtml(status)}</span>`;
  }

  const SOURCE_FIELD_GROUPS = [
    ["商品基础", 0, 3], ["交易与订单", 4, 23], ["商品经营漏斗", 24, 35], ["结算与退款", 36, 42],
    ["商城页", 43, 50], ["商家直播", 51, 75], ["商家视频", 76, 100], ["达人与内容", 101, 127],
    ["直播拆分", 128, 139], ["视频拆分", 140, 151], ["商品卡拆分", 152, 175],
  ];

  const SOURCE_METRIC_GROUPS = [
    ["核心经营漏斗", [
      ["SKU订单数", "skuOrders", "number"], ["商品成交件数", "units", "number"], ["预计客户数", "customers", "number"],
      ["平均订单金额", "avgOrderValue", "money"], ["商品曝光次数", "exposure", "number"], ["去重商品曝光次数", "uniqueExposure", "number"],
      ["商品点击量", "clicks", "number"], ["去重点击次数", "uniqueClicks", "number"], ["商品点击率", "ctr", "percent"],
      ["去重点击率", "uniqueCtr", "percent"], ["加购次数", "addToCart", "number"], ["已加购的用户数", "uniqueAtcUsers", "number"],
      ["加购率", "addToCartRate", "percent"], ["去重加购率", "uniqueAtcRate", "percent"], ["CTOR（SKU订单）", "ctor", "percent"],
      ["去重点击成交转化率", "uniqueClickCvr", "percent"],
    ]],
    ["结算与退款", [
      ["GMV", "gmv", "money"], ["含税 GMV", "taxIncludedGmv", "money"], ["税费", "tax", "money"],
      ["GMV（TikTok 合资）", "tiktokJointGmv", "money"], ["运费", "shipping", "money"], ["退款金额", "refundAmount", "money"],
      ["已退款的商品件数", "refundedUnits", "number"], ["退款客户数", "refundCustomers", "number"],
    ]],
    ["商城页经营", [
      ["商城页商品曝光次数", "mallExposure", "number"], ["商城页商品点击量", "mallClicks", "number"],
      ["商城页去重商品点击量", "mallUniqueClicks", "number"], ["预计商城页客户数", "mallCustomers", "number"],
      ["商城页点击率", "mallCtr", "percent"], ["商城页点击成交转化率", "mallCvr", "percent"],
      ["商城页 GMV", "mallGmv", "money"], ["商城页商品成交件数", "mallUnits", "number"],
    ]],
    ["归因与内容", [
      ["归因 GMV（商家直播）", "attributedGmv", "money"], ["间接 GMV（商家直播）", "indirectGmv", "money"],
      ["归因订单数", "attributedOrders", "number"], ["归因 SKU 订单数", "attributedSkuOrders", "number"],
      ["间接 SKU 订单数", "indirectSkuOrders", "number"], ["归因成交件数", "attributedUnits", "number"],
      ["间接成交件数", "indirectUnits", "number"], ["归因客户数", "attributedCustomers", "number"],
      ["AOV（归因 SKU 订单）", "attributedAov", "money"], ["已发布内容的日均达人数", "avgDailyReach", "number"],
      ["新直播场次", "newLiveSessions", "number"], ["新视频数", "newVideos", "number"],
    ]],
    ["直播拆分", [
      ["直播曝光", "liveExposure", "number"], ["直播点击", "liveClicks", "number"], ["直播 CTR", "liveCtr", "percent"],
      ["直播加购", "liveAddToCart", "number"], ["直播加购率", "liveAddToCartRate", "percent"], ["直播 CTOR", "liveCtor", "percent"],
      ["直播去重曝光", "liveUniqueExposure", "number"], ["直播去重点击", "liveUniqueClicks", "number"],
      ["直播去重 CTR", "liveUniqueCtr", "percent"], ["直播 ATC 用户", "liveAtcUsers", "number"],
      ["直播去重加购率", "liveUniqueAtcRate", "percent"], ["直播去重点击 CVR", "liveUniqueClickCvr", "percent"],
    ]],
    ["视频拆分", [
      ["视频曝光", "videoExposure", "number"], ["视频点击", "videoClicks", "number"], ["视频 CTR", "videoCtr", "percent"],
      ["视频加购", "videoAddToCart", "number"], ["视频加购率", "videoAddToCartRate", "percent"], ["视频 CTOR", "videoCtor", "percent"],
      ["视频去重曝光", "videoUniqueExposure", "number"], ["视频去重点击", "videoUniqueClicks", "number"],
      ["视频去重 CTR", "videoUniqueCtr", "percent"], ["视频 ATC 用户", "videoAtcUsers", "number"],
      ["视频去重加购率", "videoUniqueAtcRate", "percent"], ["视频去重点击 CVR", "videoUniqueClickCvr", "percent"],
    ]],
  ];

  function formatMetricValue(value, format) {
    if (format === "money") return formatMoney(value);
    if (format === "percent") return formatPercent(value);
    return formatNumber(value, 0);
  }

  function sourceMetricGroupsHtml(totals) {
    return SOURCE_METRIC_GROUPS.map(([title, fields]) => `<section class="source-metric-section">
      <div class="source-metric-section-title">${title}</div>
      <div class="real-field-grid">${fields.map(([label, key, format]) => `<div class="source-metric-card">
        <div class="source-metric-label">${label}</div><div class="source-metric-value">${formatMetricValue(totals[key], format)}</div>
      </div>`).join("")}</div>
    </section>`).join("");
  }

  function sourceFieldLabel(headers, index) {
    const header = headers[index] || `字段 ${index + 1}`;
    const occurrence = headers.slice(0, index + 1).filter((item) => item === header).length;
    return occurrence > 1 ? `${header} · 第${occurrence}组` : header;
  }

  function sourceFieldInspectorHtml(product) {
    const headers = product && Array.isArray(product.sourceHeaders) ? product.sourceHeaders : [];
    const values = product && Array.isArray(product.sourceValues) ? product.sourceValues : [];
    if (!headers.length || !values.length) return `<div class="real-ranking-empty">当前记录没有保存完整 product_list 原始字段，请重新导入 Excel。</div>`;
    return SOURCE_FIELD_GROUPS.map(([title, start, end]) => {
      const rows = headers.slice(start, end + 1).map((header, offset) => {
        const index = start + offset;
        const value = values[index] == null || values[index] === "" ? "待导入" : String(values[index]);
        return `<div class="source-field-row"><span>${escapeHtml(sourceFieldLabel(headers, index))}</span><strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong></div>`;
      }).join("");
      return `<section class="source-field-section"><div class="source-field-section-title">${title}</div><div class="source-field-rows">${rows}</div></section>`;
    }).join("");
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
    const scopedProducts = productsInScope().sort((left, right) => (right.gmv ?? 0) - (left.gmv ?? 0));
    const topProducts = scopedProducts.slice(0, 12);
    const productRows = topProducts.map((product) => `<tr>
      <td>${escapeHtml(product.store)}</td><td>${escapeHtml(product.id)}</td><td><span class="long-text" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</span></td>
      <td>${formatNumber(product.units, 0)}</td><td>${formatMoney(product.gmv)}</td><td>${formatNumber(product.orders, 0)}</td><td>${formatNumber(product.skuOrders, 0)}</td><td>${formatNumber(product.customers, 0)}</td><td>${formatMoney(product.avgOrderValue)}</td><td>${formatCompact(product.exposure)}</td><td>${formatNumber(product.clicks, 0)}</td><td>${formatPercent(product.ctr)}</td><td>${formatNumber(product.addToCart, 0)}</td><td>${formatPercent(product.addToCartRate)}</td><td>${formatPercent(product.ctor)}</td><td>${formatPercent(product.uniqueClickCvr)}</td><td>${statusTag("已导入")}</td>
    </tr>`).join("") || `<tr><td colspan="17" class="real-ranking-empty">当前日期范围暂无商品明细。</td></tr>`;
    const sourceFieldCount = scopedProducts.find((product) => Array.isArray(product.sourceHeaders) && product.sourceHeaders.length)?.sourceHeaders.length || 0;
    const inspectorOptions = scopedProducts.map((product, index) => `<option value="${index}">${escapeHtml(product.store)} · ${escapeHtml(product.id)} · ${escapeHtml(product.name)}</option>`).join("");
    container.innerHTML = `<div class="card real-data-card">
      <div class="card-title">✅ 已导入真实店铺数据 <span>${escapeHtml(scopeLabel())} · ${escapeHtml(dateRangeLabel())}</span></div>
      <div class="desktop-table-wrap"><table class="desktop-table"><thead><tr><th>店铺</th><th>最新快照</th><th>商品数</th><th>GMV</th><th>订单数</th><th>曝光</th><th>成交转化率</th><th>状态</th></tr></thead><tbody>${storeRows}</tbody></table></div>
      <div class="real-data-note">当前页面按每个店铺在所选日期范围内的最新可用快照汇总，避免把快照重复相加；GMV 上涨/下降和 CVR 下降按范围内首个与最新快照、同一店铺同一商品 ID 匹配计算。范围内只有一个日期时，不生成趋势结论。</div>
    </div>
    <div class="card real-data-card">
      <div class="card-title">📌 product_list 全字段经营视图 <span>${escapeHtml(scopeLabel())} · ${sourceFieldCount || "待导入"} 个来源字段 · 当前范围最新可用快照</span></div>
      <div class="real-data-note">已把 Excel 中的核心漏斗、结算退款、商城页、归因内容，以及直播/视频拆分字段全部写入网站。汇总卡只计算可以安全相加或按分子分母重算的指标；重复的来源列按所属业务分组保留，避免把不同渠道误加在一起。</div>
      <div class="source-metric-groups">${sourceMetricGroupsHtml(totals)}</div>
    </div>
    <div class="card real-data-card">
      <div class="card-title">📦 商品经营明细 Top12 <span>${formatNumber(totals.productCount, 0)} 个最新商品记录中按 GMV 排序</span></div>
      <div class="desktop-table-wrap"><table class="desktop-table real-product-table"><thead><tr><th>店铺</th><th>商品 ID</th><th>商品名称</th><th>成交件数</th><th>GMV</th><th>订单数</th><th>SKU订单数</th><th>预计客户</th><th>均单金额</th><th>曝光</th><th>点击量</th><th>CTR</th><th>加购次数</th><th>加购率</th><th>CTOR</th><th>去重点击CVR</th><th>状态</th></tr></thead><tbody>${productRows}</tbody></table></div>
    </div>
    <div class="card real-data-card">
      <div class="card-title">🔎 商品 product_list 完整字段 <span>逐项核对原始 Excel · 不压缩、不丢重复渠道字段</span></div>
      ${scopedProducts.length ? `<label class="source-product-label" for="source-field-product">选择商品查看全部来源字段（当前范围 ${formatNumber(scopedProducts.length, 0)} 条）</label><select id="source-field-product" class="source-product-select">${inspectorOptions}</select><div id="source-field-inspector" class="source-field-inspector">${sourceFieldInspectorHtml(scopedProducts[0])}</div>` : `<div class="real-ranking-empty">当前日期范围暂无商品明细。</div>`}
    </div>`;
    const inspectorSelect = container.querySelector("#source-field-product");
    const inspector = container.querySelector("#source-field-inspector");
    if (inspectorSelect && inspector) inspectorSelect.addEventListener("change", () => {
      inspector.innerHTML = sourceFieldInspectorHtml(scopedProducts[Number(inspectorSelect.value)]);
    });
  }

  function updateDataSourceStatus() {
    const page = document.getElementById("page-data");
    if (!page) return;
    const sourceCard = [...page.querySelectorAll(".card")].find((card) => card.querySelector(".card-title")?.textContent.includes("字段与来源登记"));
    const sourceRow = sourceCard && sourceCard.querySelector(".desktop-table tbody tr");
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
    let previousData = currentData;
    try {
      await dataReadyPromise;
      previousData = currentData;
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
      await saveCurrentData();
      selectedStore = "all";
      selectedDatePreset = "all";
      customStartDate = "";
      customEndDate = "";
      renderAll();
      updateUploadStatus(`已导入 ${importedSnapshots.length} 个文件 · ${importedSnapshots.reduce((sum, snapshot) => sum + snapshot.productCount, 0)} 条商品`);
      window.alert(`✅ 数据导入完成\n\n${importedSnapshots.map((snapshot) => `${parseStoreFromFilename(snapshot.sourceFile)} · ${snapshot.reportDate}：${snapshot.productCount} 条商品`).join("\n")}\n\n历史快照已按店铺和日期保存。`);
    } catch (error) {
      currentData = previousData;
      renderAll();
      updateUploadStatus("导入失败，请检查文件格式", "error");
      window.alert(`❌ 导入失败\n\n${error.message || "无法识别该文件"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function resetLocalStoreData() {
    const confirmed = window.confirm("确认清除当前浏览器导入的历史快照，并恢复网站公开快照吗？\n\n此操作不会删除你的原始 Excel 文件。");
    if (!confirmed) return;
    updateUploadStatus("正在恢复公开快照…");
    try {
      await dataReadyPromise;
      await clearIndexedData();
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      currentData = normalizeData(sourceData);
      selectedStore = "all";
      selectedDatePreset = "all";
      customStartDate = "";
      customEndDate = "";
      renderAll();
      updateUploadStatus("已恢复公开快照");
    } catch (error) {
      updateUploadStatus("恢复失败，请刷新后重试", "error");
      window.alert(`❌ 恢复失败\n\n${error.message || "无法清除本地历史快照"}`);
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

  bindFilters();
  const fileInput = document.getElementById("real-store-file-input");
  if (fileInput) fileInput.addEventListener("change", handleFileImport);
  const resetButton = document.getElementById("reset-real-store-data");
  if (resetButton) resetButton.addEventListener("click", resetLocalStoreData);
  renderAll();
  const dataReadyPromise = loadSavedData()
    .then((restored) => {
      if (restored) {
        renderAll();
        updateUploadStatus("已恢复当前浏览器历史快照");
      }
    })
    .catch((error) => {
      console.warn("Unable to restore local store data", error);
      updateUploadStatus("公开快照已加载；本地历史读取失败", "error");
    });
})();
