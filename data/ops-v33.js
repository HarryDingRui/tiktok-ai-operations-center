/* ==========================================================================
 * TikTok AI 智能运营中控台 v3.3 — 决策驱动运营引擎
 * --------------------------------------------------------------------------
 * 设计原则（与店主逐条对齐）：
 * · 看板不是越多越好：每个模块只呈现「有实际运营决策价值」的最小集合
 * · 全量数据互通：商品ID / 达人账号 / Video ID 三键跨模块取证，相关性≠因果
 * · 数据上传自适应：店铺导出什么传什么，缺数据显示"待导入"，绝不编造
 * · 计划是消耗品，素材是资产：GMVMax 生命周期管理 + 优质素材自动入库
 * · 节奏自助：每个模块 日更/周更/不定期 下拉自切，到期自动提醒
 * --------------------------------------------------------------------------
 * 数据集（全部存 IndexedDB，仅本机）：
 *   adCreatives  广告素材级快照（GMVMax creative data，导入时自动滤掉 消耗≤0且无单无收入 的行）
 *   creatorDaily 达人订单日快照（一达人一行）
 *   affOrders    联盟订单流水（一订单一行，含佣金）
 *   samples      样品订单（SKU 寄样台账）
 *   affVideos    联盟视频订单（一视频一行，含 GPM/完播）
 *   selfVideos   自营账号前台数据（播放/发布，GMV 从联盟视频拼接）
 *   orders       订单明细（OrderSKUList，一行=订单×SKU，成交价扫码）
 *   pricing      价格利润核算表（定价/费率/运费阶梯，IDB 单键整表覆盖）
 * ========================================================================== */
(function () {
  "use strict";

  const bridge = window.OPS_BRIDGE;
  if (!bridge) {
    console.warn("OPS_BRIDGE 未就绪，v3.3 引擎跳过初始化");
    return;
  }
  const {
    formatNumber, formatCompact, escapeHtml, isDateKey, addDays, normalizeHeaderText,
  } = bridge;

  /* ================= 可配置阈值（看板上可改，存本机） ================= */
  const THRESHOLDS_KEY = "tiktok-v33-thresholds";
  const DEFAULT_THRESHOLDS = {
    qualityRoi: 6,        // 优质素材 ROI 门槛（有单 且 ROI≥此值）
    qualityMinSpend: 0.5, // 已验证 vs 待放量 的消耗分界
    observeDays: 3,       // 新计划观察期（天）
    observeMinSpend: 3,   // 观察期内累计消耗低于此值 = 消耗没起来
    defaultTargetRoi: 3,  // 命名未带目标 ROI 时的达标线
    warnStreak: 3,        // 老计划连续 N 天消耗&ROI 双降 → 预警
    killStreak: 5,        // 连续下滑到第 N 天 → 关停重建
    assetDecayDays: 7,    // 素材连续 N 天无消耗无出单 → 标衰退
    topN: 5,              // 头部集中度取 Top N
    concentration: 0.6,   // Top N GMV 占比超过此值 → 集中度预警
    exposureZeroMin: 1000,// 高曝光 0 产出的曝光门槛
  };
  function getThresholds() {
    try {
      return Object.assign({}, DEFAULT_THRESHOLDS, JSON.parse(window.localStorage.getItem(THRESHOLDS_KEY) || "{}"));
    } catch (e) { return Object.assign({}, DEFAULT_THRESHOLDS); }
  }
  function saveThresholds(patch) {
    const next = Object.assign(getThresholds(), patch);
    try { window.localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }

  /* ================= 更新节奏（日更/周更/不定期，自助切换） ================= */
  const CADENCE_KEY = "tiktok-v33-cadence";
  const CADENCE_OPTIONS = [
    { value: "daily", label: "日更", warn: 2, over: 4 },
    { value: "weekly", label: "周更", warn: 8, over: 14 },
    { value: "free", label: "不定期", warn: Infinity, over: Infinity },
  ];
  const DEFAULT_CADENCE = {
    products: "daily", creatorDaily: "daily", affOrders: "daily", samples: "daily",
    adCreatives: "daily", affVideos: "weekly", selfVideos: "weekly", assets: "free",
    orders: "daily", pricing: "free",
  };
  function getCadence(datasetKey) {
    try {
      const cfg = JSON.parse(window.localStorage.getItem(CADENCE_KEY) || "{}");
      return cfg[datasetKey] || DEFAULT_CADENCE[datasetKey] || "free";
    } catch (e) { return DEFAULT_CADENCE[datasetKey] || "free"; }
  }
  function setCadence(datasetKey, value) {
    let cfg = {};
    try { cfg = JSON.parse(window.localStorage.getItem(CADENCE_KEY) || "{}"); } catch (e) {}
    cfg[datasetKey] = value;
    try { window.localStorage.setItem(CADENCE_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  /* ================= 本地存储 ================= */
  const DATABASE_NAME = "tiktok-ai-operations-center";
  const DATABASE_STORE = "datasets";
  const VIDEO_DB_NAME = "tiktok-ops-assets";
  const VIDEO_DB_STORE = "videos";
  const V33_DATA_KEY = "ops-v33-data";
  const V33_META_KEY = "ops-v33-meta";

  const EMPTY_DATA = () => ({
    adCreatives: [], creatorDaily: [], affOrders: [], samples: [], affVideos: [], selfVideos: [], orders: [],
  });
  let v33 = EMPTY_DATA();
  window.OPS_V33_READY = false;
  let meta = { lastImport: {}, removedAssets: [] };
  let latestDataDateCache;

  function invalidateLatestDataDate() {
    latestDataDateCache = undefined;
  }

  function latestAvailableDataDate() {
    if (latestDataDateCache !== undefined) return latestDataDateCache;
    const dates = [];
    const cloudOverview = window.TIKTOK_CLOUD_SNAPSHOT?.overview;
    Object.values(cloudOverview || {}).forEach((rows) => {
      (rows || []).forEach((row) => { if (isDateKey(row.date)) dates.push(row.date); });
    });
    const source = bridge.getData && bridge.getData();
    (source?.stores || []).forEach((store) => (store.snapshots || []).forEach((snapshot) => {
      if (isDateKey(snapshot.reportDate)) dates.push(snapshot.reportDate);
    }));
    if (!dates.length) {
      Object.values(v33).forEach((rows) => (rows || []).forEach((row) => {
        if (isDateKey(row.date)) dates.push(row.date);
      }));
    }
    latestDataDateCache = dates.sort().pop() || "";
    return latestDataDateCache;
  }

  function openDb(name, store) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error("本地存储无响应")); }
      }, 2500);
      try {
        const request = window.indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
        };
        request.onsuccess = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(request.result); } };
        request.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); reject(request.error || new Error("无法打开本地存储")); } };
        request.onblocked = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error("本地存储被占用")); } };
      } catch (e) {
        if (!settled) { settled = true; clearTimeout(timer); reject(e); }
      }
    });
  }
  async function idbGet(key) {
    const db = await openDb(DATABASE_NAME, DATABASE_STORE);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DATABASE_STORE, "readonly");
      const req = tx.objectStore(DATABASE_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbPut(key, value) {
    const db = await openDb(DATABASE_NAME, DATABASE_STORE);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DATABASE_STORE, "readwrite");
      tx.objectStore(DATABASE_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function loadCloudV33() {
    const snapshot = window.TIKTOK_CLOUD_SNAPSHOT;
    if (snapshot?.v33 && typeof snapshot.v33 === "object") return snapshot.v33;
    if (snapshot?.v33Urls && typeof snapshot.v33Urls === "object") {
      const entries = await Promise.all(Object.entries(snapshot.v33Urls).map(async ([dataset, url]) => {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) throw new Error(`云端 ${dataset} 数据读取失败（HTTP ${response.status}）`);
        return [dataset, await response.json()];
      }));
      return Object.fromEntries(entries);
    }
    if (!snapshot?.v33Url) return null;
    const response = await fetch(snapshot.v33Url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`云端分析数据读取失败（HTTP ${response.status}）`);
    const parsed = await response.json();
    return parsed && typeof parsed === "object" ? parsed : null;
  }
  async function loadV33() {
    const cloudSnapshot = window.TIKTOK_CLOUD_SNAPSHOT;
    if (window.localStorage.getItem("tiktok-real-data-state-v4") === "cleared" && !cloudSnapshot?.published) return;
    let cloud = null;
    try {
      cloud = await loadCloudV33();
    } catch (error) {
      console.warn("云端分析数据读取失败，继续使用本地数据", error);
    }
    const base = EMPTY_DATA();
    if (cloud && typeof cloud === "object") {
      Object.keys(base).forEach((k) => { if (Array.isArray(cloud[k])) base[k] = cloud[k]; });
    }
    try {
      const row = await idbGet(V33_DATA_KEY);
      if (row && typeof row === "object") {
        // 本地导入优先；仅当某个数据集没有本地记录时，才用云端快照补齐。
        Object.keys(base).forEach((k) => {
          if (Array.isArray(row[k]) && row[k].length > 0) base[k] = row[k];
        });
      }
    } catch (e) { console.warn("v3.3 本地数据读取失败，继续使用云端快照", e); }
    v33 = base;
    invalidateLatestDataDate();
    try {
      const m = await idbGet(V33_META_KEY);
      if (m && typeof m === "object") {
        meta.lastImport = m.lastImport || {};
        meta.removedAssets = Array.isArray(m.removedAssets) ? m.removedAssets : [];
      }
    } catch (e) { console.warn("v3.3 元数据读取失败，继续使用云端日期", e); }
    if (!Object.keys(meta.lastImport).length && cloud && typeof cloud === "object") {
      Object.entries(cloud).forEach(([dataset, rows]) => {
        const latest = (Array.isArray(rows) ? rows : []).map((row) => row.date).filter(isDateKey).sort().pop();
        if (latest) meta.lastImport[dataset] = `${latest}T00:00:00.000Z`;
      });
    }
    try {
      const p = await idbGet("ops-v33-pricing");
      if (p && typeof p === "object" && Array.isArray(p.skus)) { pricing = p; pricingIndex = null; }
    } catch (e) { console.warn("价格数据读取失败，继续使用其他云端数据", e); }
  }
  async function saveV33() {
    try { await idbPut(V33_DATA_KEY, v33); await idbPut(V33_META_KEY, meta); await idbPut("ops-v33-pricing", pricing); }
    catch (e) { console.warn("v3.3 数据保存失败（本次会话内数据仍可用，刷新后需重新导入）", e); }
  }
  async function saveVideoBlob(file) {
    const db = await openDb(VIDEO_DB_NAME, VIDEO_DB_STORE);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VIDEO_DB_STORE, "readwrite");
      tx.objectStore(VIDEO_DB_STORE).put(file, file.name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getVideoBlob(name) {
    try {
      const db = await openDb(VIDEO_DB_NAME, VIDEO_DB_STORE);
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(VIDEO_DB_STORE, "readonly");
        const req = tx.objectStore(VIDEO_DB_STORE).get(name);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { return null; }
  }

  /* ================= 解析工具 ================= */
  // 数字：剥 ฿ $ ¥ , % 空格；"-" "--" "N/A" → null
  function cleanNum(v) {
    if (v == null) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s || /^[-–—]+$/.test(s) || /^n\/?a$/i.test(s)) return null;
    const n = Number(s.replace(/[฿$¥,\s%]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  // 文本："-"/"N/A"/空 → ""
  function cleanText(v) {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s || s === "-" || /^n\/?a$/i.test(s)) return "";
    return s;
  }
  // ID 类（19 位数字绝不能进 Number）：保留原始字符串
  function cleanId(v) {
    const s = cleanText(v);
    if (!s) return "";
    const m = s.match(/\d{6,}/);
    return m ? m[0] : s;
  }
  // 日期解析：ISO、YYYY-MM-DD、DD/MM/YYYY、MM/DD/YYYY（带参考日消歧）、带时间后缀
  function parseAnyDate(raw, opts) {
    const order = (opts && opts.order) || "DMY";
    const ref = (opts && opts.ref) || "";
    if (raw == null || raw === "") return "";
    if (raw instanceof Date && !isNaN(raw)) return raw.toISOString().slice(0, 10);
    const s = String(raw).trim();
    let m = s.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
    if (m) {
      let a = Number(m[1]), b = Number(m[2]);
      const y = m[3];
      const build = (d, mo) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";
      if (a > 12) return build(a, b);            // 只能是 日/月
      if (b > 12) return build(b, a);            // 只能是 月/日
      const dmy = build(a, b), mdy = build(b, a);
      if (order === "MDY") return mdy || dmy;
      if (ref && isDateKey(ref)) {
        // 两种解释都合法时，取不超过参考日的那个
        const dmyOk = dmy && dmy <= ref, mdyOk = mdy && mdy <= ref;
        if (dmyOk && !mdyOk) return dmy;
        if (mdyOk && !dmyOk) return mdy;
      }
      return dmy || mdy;
    }
    return "";
  }
  // 文件名里的日期：20260831 / 2026-08-31 / 2026_08_31
  function dateFromFilename(name) {
    const s = String(name || "");
    let m = s.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/(20\d{2})(\d{2})(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return "";
  }

  const KNOWN_STORES = ["INSPIRE PURIFY", "Miniyaya", "PETTOS", "yaya thailand tth", "yaya112"];
  function storeFromFilename(name) {
    const normalized = normalizeHeaderText(name || "");
    return KNOWN_STORES.find((store) => normalized.includes(normalizeHeaderText(store))) || "";
  }

  function selectedScopeBounds() {
    const preset = document.getElementById("date-range-preset")?.value || "all";
    if (preset === "all") return null;
    if (preset === "custom") {
      return {
        start: document.getElementById("date-range-start")?.value || "",
        end: document.getElementById("date-range-end")?.value || "",
      };
    }
    const latest = latestAvailableDataDate();
    // The shared date selector uses numeric values ("7" / "14"). Keep the
    // legacy names working as well because imported local state may still use them.
    const days = preset === "7" || preset === "last7"
      ? 6
      : preset === "14" || preset === "last14"
        ? 13
        : 0;
    return latest ? { start: addDays(latest, -days), end: latest } : null;
  }

  function scopedRows(datasetKey) {
    let rows = [...(v33[datasetKey] || [])];
    const store = document.getElementById("store-filter")?.value || "all";
    if (store !== "all") rows = rows.filter((row) => row.store === store);
    const bounds = selectedScopeBounds();
    if (bounds?.start) rows = rows.filter((row) => row.date >= bounds.start && (!bounds.end || row.date <= bounds.end));
    return rows;
  }
  function scopedOverviewRows(datasetKey) {
    let rows = [...(window.TIKTOK_CLOUD_SNAPSHOT?.overview?.[datasetKey] || [])];
    const store = document.getElementById("store-filter")?.value || "all";
    if (store !== "all") rows = rows.filter((row) => row.store === store);
    const bounds = selectedScopeBounds();
    if (bounds?.start) rows = rows.filter((row) => row.date >= bounds.start && (!bounds.end || row.date <= bounds.end));
    return rows;
  }

  function addImportScope(records, fileName) {
    const store = storeFromFilename(fileName);
    return records.map((record) => (record.store || !store ? record : { ...record, store }));
  }
  // 读工作簿：返回 [{sheetName, rows}]
  async function readWorkbook(file) {
    await bridge.ensureXlsxLibrary();
    const isCsv = /\.csv$/i.test(file.name);
    const buffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("文件读取失败"));
      if (isCsv) reader.readAsText(file, "UTF-8");
      else reader.readAsArrayBuffer(file);
    });
    const workbook = isCsv
      ? window.XLSX.read(buffer, { type: "string" })
      : window.XLSX.read(buffer, { type: "array", cellText: true, cellDates: false });
    return workbook.SheetNames.map((sheetName) => ({
      sheetName,
      rows: window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false }),
    }));
  }
  // 在某 sheet 前 6 行里找表头行：命中关键词最多的那行
  function locateHeaderRow(rows, keywords) {
    let best = { index: -1, score: 0 };
    rows.slice(0, 6).forEach((row, index) => {
      const cells = (row || []).map((c) => normalizeHeaderText(c == null ? "" : String(c)));
      const score = keywords.reduce((acc, kw) => acc + (cells.some((c) => c === normalizeHeaderText(kw) || c.includes(normalizeHeaderText(kw))) ? 1 : 0), 0);
      if (score > best.score) best = { index, score };
    });
    return best.score >= 2 ? best.index : -1;
  }
  // 表头 → 列索引（同义词命中，每列只用一次）
  function columnIndex(headers, synonyms) {
    const norm = headers.map((h) => normalizeHeaderText(h == null ? "" : String(h)));
    const syns = synonyms.map((s) => normalizeHeaderText(s));
    for (const syn of syns) {
      const exact = norm.indexOf(syn);
      if (exact >= 0) return exact;
    }
    for (const syn of syns) {
      const partial = norm.findIndex((c) => c && (c.includes(syn) || syn.includes(c)));
      if (partial >= 0) return partial;
    }
    return -1;
  }
  const HEAD = (headers, synonyms) => columnIndex(headers, synonyms);

  /* ================= 各数据集解析器（按真实导出格式 + 自适应兜底） ================= */

  // 广告 GMVMax creative data：一行 = 计划×商品×素材×达人；自动过滤 消耗≤0且无单无收入
  async function parseAdCreatives(file) {
    const sheets = await readWorkbook(file);
    const fileDate = dateFromFilename(file.name);
    const out = [];
    let dropped = 0;
    for (const { rows } of sheets) {
      const hi = locateHeaderRow(rows, ["广告计划名称", "Campaign ID", "Product ID", "Creative type", "成本"]);
      if (hi < 0) continue;
      const headers = rows[hi].map((c) => String(c ?? "").trim());
      const col = {
        plan: HEAD(headers, ["广告计划名称", "计划名称", "Campaign name", "Campaign"]),
        campaignId: HEAD(headers, ["Campaign ID"]),
        productId: HEAD(headers, ["Product ID", "商品 ID", "商品ID"]),
        creativeType: HEAD(headers, ["Creative type", "素材类型"]),
        title: HEAD(headers, ["视频标题", "Video title", "素材标题"]),
        videoId: HEAD(headers, ["Video ID", "视频 ID", "视频ID"]),
        account: HEAD(headers, ["TikTok account", "达人账号", "账号"]),
        timePosted: HEAD(headers, ["Time posted", "发布时间"]),
        status: HEAD(headers, ["Status", "状态"]),
        subStatus: HEAD(headers, ["Exploration secondary status", "二级状态"]),
        auth: HEAD(headers, ["Authorization type", "授权类型"]),
        spend: HEAD(headers, ["成本", "消耗", "Cost", "Spend"]),
        orders: HEAD(headers, ["SKU 订单数", "订单数", "Orders"]),
        cpa: HEAD(headers, ["平均下单成本"]),
        revenue: HEAD(headers, ["总收入", "GMV", "Revenue"]),
        impressions: HEAD(headers, ["Product ad impressions", "曝光"]),
        clicks: HEAD(headers, ["Product ad clicks", "点击"]),
        currency: HEAD(headers, ["Currency", "币种"]),
      };
      if (col.plan < 0 && col.campaignId < 0) continue;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const spend = cleanNum(r[col.spend]);
        const orders = cleanNum(r[col.orders]);
        const revenue = cleanNum(r[col.revenue]);
        // 核心过滤：零消耗且无单无收入的素材池行直接丢弃（店主确认）
        if (!(spend > 0 || orders > 0 || revenue > 0)) { dropped += 1; continue; }
        out.push({
          date: fileDate,
          plan: cleanText(r[col.plan]),
          campaignId: cleanId(r[col.campaignId]),
          productId: cleanId(r[col.productId]),
          creativeType: cleanText(r[col.creativeType]) || "Video",
          title: cleanText(r[col.title]),
          videoId: cleanId(r[col.videoId]),
          account: cleanText(r[col.account]),
          timePosted: cleanText(r[col.timePosted]),
          status: cleanText(r[col.status]),
          subStatus: cleanText(r[col.subStatus]),
          auth: cleanText(r[col.auth]),
          spend: spend || 0,
          orders: orders || 0,
          cpa: cleanNum(r[col.cpa]),
          revenue: revenue || 0,
          impressions: cleanNum(r[col.impressions]) || 0,
          clicks: cleanNum(r[col.clicks]) || 0,
          currency: cleanText(r[col.currency]) || "",
        });
      }
    }
    if (!out.length) throw new Error(`${file.name}：未识别到有效广告行（可能全部是零消耗素材池行）`);
    return { records: out, note: `保留有消耗/有成交 ${out.length} 条，过滤零消耗素材池 ${dropped} 条` };
  }

  // 达人订单：一达人一行/天
  async function parseCreatorDaily(file) {
    const sheets = await readWorkbook(file);
    const fileDate = dateFromFilename(file.name);
    const out = [];
    for (const { rows } of sheets) {
      const hi = locateHeaderRow(rows, ["达人用户名", "联盟 GMV", "商品曝光次数"]);
      if (hi < 0) continue;
      const headers = rows[hi].map((c) => String(c ?? "").trim());
      const col = {
        creator: HEAD(headers, ["达人用户名", "达人名称", "达人", "Creator"]),
        gmv: HEAD(headers, ["联盟 GMV", "联盟GMV"]),
        liveGmv: HEAD(headers, ["联盟直播 GMV"]),
        videoGmv: HEAD(headers, ["联盟带货视频 GMV"]),
        cardGmv: HEAD(headers, ["联盟商品卡 GMV"]),
        items: HEAD(headers, ["联盟商品成交件数"]),
        orders: HEAD(headers, ["成交件数", "联盟订单量"]),
        commission: HEAD(headers, ["预计佣金"]),
        avgOrder: HEAD(headers, ["平均订单金额"]),
        ctr: HEAD(headers, ["点击率"]),
        exposure: HEAD(headers, ["商品曝光次数"]),
        customers: HEAD(headers, ["平均联盟客户数"]),
        lives: HEAD(headers, ["联盟直播数"]),
        videos: HEAD(headers, ["联盟带货视频数"]),
        directedGmv: HEAD(headers, ["定向合作 GMV"]),
        openGmv: HEAD(headers, ["公开合作 GMV"]),
        refundGmv: HEAD(headers, ["联盟已退款的 GMV"]),
        fans: HEAD(headers, ["联盟粉丝数", "粉丝数"]),
      };
      if (col.creator < 0) continue;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const creator = cleanText(r[col.creator]);
        if (!creator) continue;
        out.push({
          date: fileDate,
          creator,
          gmv: cleanNum(r[col.gmv]),
          liveGmv: cleanNum(r[col.liveGmv]),
          videoGmv: cleanNum(r[col.videoGmv]),
          cardGmv: cleanNum(r[col.cardGmv]),
          items: cleanNum(r[col.items]),
          orders: cleanNum(r[col.orders]),
          commission: cleanNum(r[col.commission]),
          avgOrder: cleanNum(r[col.avgOrder]),
          ctr: cleanNum(r[col.ctr]),
          exposure: cleanNum(r[col.exposure]),
          lives: cleanNum(r[col.lives]),
          videos: cleanNum(r[col.videos]),
          directedGmv: cleanNum(r[col.directedGmv]),
          openGmv: cleanNum(r[col.openGmv]),
          refundGmv: cleanNum(r[col.refundGmv]),
          fans: cleanNum(r[col.fans]),
        });
      }
    }
    if (!out.length) throw new Error(`${file.name}：未识别到达人行（需要「达人用户名」列）`);
    return { records: out, note: `${out.length} 位达人` };
  }

  // 联盟订单：一订单一行
  async function parseAffOrders(file) {
    const sheets = await readWorkbook(file);
    const fileDate = dateFromFilename(file.name);
    const out = [];
    for (const { rows } of sheets) {
      const hi = locateHeaderRow(rows, ["订单 ID", "商品 ID", "达人用户名"]);
      if (hi < 0) continue;
      const headers = rows[hi].map((c) => String(c ?? "").trim());
      const col = {
        orderId: HEAD(headers, ["订单 ID", "订单ID", "Order ID"]),
        productId: HEAD(headers, ["商品 ID", "商品ID", "Product ID"]),
        productName: HEAD(headers, ["商品名称", "Product Name"]),
        skuId: HEAD(headers, ["SKU ID", "SKUID"]),
        amount: HEAD(headers, ["支付金额", "Order Amount"]),
        qty: HEAD(headers, ["下单件数", "Quantity"]),
        status: HEAD(headers, ["订单状态", "Order Status"]),
        creator: HEAD(headers, ["达人用户名", "达人名称", "达人"]),
        contentType: HEAD(headers, ["内容形式"]),
        contentId: HEAD(headers, ["内容ID", "内容 ID"]),
        commission: HEAD(headers, ["实际佣金", "实际佣金付款"]),
        estCommission: HEAD(headers, ["预计标准佣金付款"]),
        estAdCommission: HEAD(headers, ["预计店铺广告佣金付款"]),
        commissionRate: HEAD(headers, ["标准佣金率", "店铺广告佣金率", "佣金率"]),
        createdAt: HEAD(headers, ["创建时间", "Created Time"]),
      };
      if (col.orderId < 0) continue;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const orderId = cleanId(r[col.orderId]);
        if (!orderId) continue;
        const created = parseAnyDate(r[col.createdAt], { order: "DMY", ref: fileDate });
        out.push({
          date: created || fileDate,
          orderId,
          productId: cleanId(r[col.productId]),
          productName: cleanText(r[col.productName]),
          skuId: cleanId(r[col.skuId]),
          amount: cleanNum(r[col.amount]),
          qty: cleanNum(r[col.qty]),
          status: cleanText(r[col.status]),
          creator: cleanText(r[col.creator]),
          contentType: cleanText(r[col.contentType]),
          contentId: cleanId(r[col.contentId]),
          commission: (() => {
            const actual = cleanNum(r[col.commission]);
            if (actual != null) return actual;
            const std = cleanNum(r[col.estCommission]);
            const ad = cleanNum(r[col.estAdCommission]);
            if (std == null && ad == null) return null;
            return (std || 0) + (ad || 0);
          })(),
          commissionRate: cleanNum(r[col.commissionRate]),
        });
      }
    }
    if (!out.length) throw new Error(`${file.name}：未识别到订单行（需要「订单 ID」列）`);
    return { records: out, note: `${out.length} 笔订单` };
  }

  // 样品订单：OrderSKUList（第2行是字段描述，跳过）
  async function parseSamples(file) {
    const sheets = await readWorkbook(file);
    const fileDate = dateFromFilename(file.name);
    const out = [];
    for (const { rows } of sheets) {
      const hi = locateHeaderRow(rows, ["Order ID", "SKU ID", "Seller SKU"]);
      if (hi < 0) continue;
      const headers = rows[hi].map((c) => String(c ?? "").trim());
      const col = {
        orderId: HEAD(headers, ["Order ID"]),
        status: HEAD(headers, ["Order Status"]),
        skuId: HEAD(headers, ["SKU ID"]),
        sellerSku: HEAD(headers, ["Seller SKU"]),
        productName: HEAD(headers, ["Product Name"]),
        variation: HEAD(headers, ["Variation"]),
        qty: HEAD(headers, ["Quantity"]),
        createdAt: HEAD(headers, ["Created Time"]),
      };
      if (col.orderId < 0 || col.sellerSku < 0) continue;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const orderId = cleanId(r[col.orderId]);
        if (!orderId || !/^\d{6,}$/.test(orderId)) continue; // 跳过描述行
        const created = parseAnyDate(r[col.createdAt], { order: "DMY", ref: fileDate });
        out.push({
          date: created || fileDate,
          orderId,
          status: cleanText(r[col.status]),
          skuId: cleanId(r[col.skuId]),
          sellerSku: cleanText(r[col.sellerSku]),
          productName: cleanText(r[col.productName]),
          variation: cleanText(r[col.variation]),
          qty: cleanNum(r[col.qty]) ?? 1,
        });
      }
    }
    if (!out.length) throw new Error(`${file.name}：未识别到样品行（需要 Order ID / Seller SKU 列）`);
    return { records: out, note: `${out.length} 件样品` };
  }

  // 全部视频订单：一视频一行（第2行是指标描述，跳过）；发布日期是 MM/DD/YYYY
  async function parseAffVideos(file) {
    const sheets = await readWorkbook(file);
    const fileDate = dateFromFilename(file.name);
    const out = [];
    for (const { rows } of sheets) {
      const hi = locateHeaderRow(rows, ["视频 ID", "视频标题", "联盟视频归因 GMV"]);
      if (hi < 0) continue;
      const headers = rows[hi].map((c) => String(c ?? "").trim());
      const col = {
        title: HEAD(headers, ["视频标题"]),
        videoId: HEAD(headers, ["视频 ID", "视频ID", "Video ID"]),
        publishAt: HEAD(headers, ["发布日期", "发布时间"]),
        link: HEAD(headers, ["视频链接"]),
        creator: HEAD(headers, ["达人名称", "达人用户名", "达人"]),
        productId: HEAD(headers, ["商品 ID", "商品ID", "Product ID"]),
        gmv: HEAD(headers, ["联盟视频归因 GMV", "视频归因 GMV", "GMV"]),
        orders: HEAD(headers, ["归因于视频的订单数", "订单数"]),
        items: HEAD(headers, ["视频归因成交件数", "成交件数"]),
        refund: HEAD(headers, ["退款金额"]),
        likes: HEAD(headers, ["点赞数"]),
        comments: HEAD(headers, ["评论数"]),
        shares: HEAD(headers, ["分享次数"]),
        exposure: HEAD(headers, ["视频商品曝光次数"]),
        clicks: HEAD(headers, ["视频商品点击量"]),
        finishRate: HEAD(headers, ["完播率"]),
        views: HEAD(headers, ["视频播放量", "播放量"]),
        ctr: HEAD(headers, ["商品点击率"]),
        gpm: HEAD(headers, ["视频千次曝光成交金额", "千次曝光成交"]),
        commission: HEAD(headers, ["预计佣金"]),
      };
      if (col.videoId < 0) continue;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const videoId = cleanId(r[col.videoId]);
        if (!videoId || !/^\d{6,}$/.test(videoId)) continue; // 跳过描述行/空行
        const publishAt = parseAnyDate(r[col.publishAt], { order: "MDY", ref: fileDate });
        out.push({
          date: fileDate, // 数据所属日（导出日期）
          videoId,
          title: cleanText(r[col.title]),
          publishAt,
          link: cleanText(r[col.link]),
          creator: cleanText(r[col.creator]),
          productId: cleanId(r[col.productId]),
          gmv: cleanNum(r[col.gmv]),
          orders: cleanNum(r[col.orders]),
          items: cleanNum(r[col.items]),
          refund: cleanNum(r[col.refund]),
          likes: cleanNum(r[col.likes]),
          comments: cleanNum(r[col.comments]),
          shares: cleanNum(r[col.shares]),
          exposure: cleanNum(r[col.exposure]),
          clicks: cleanNum(r[col.clicks]),
          finishRate: cleanNum(r[col.finishRate]),
          views: cleanNum(r[col.views]),
          ctr: cleanNum(r[col.ctr]),
          gpm: cleanNum(r[col.gpm]),
          commission: cleanNum(r[col.commission]),
        });
      }
    }
    if (!out.length) throw new Error(`${file.name}：未识别到视频行（需要「视频 ID」列）`);
    return { records: out, note: `${out.length} 条视频` };
  }

  // 自营账号前台数据（格式未定，自适应：日期/账号/视频/商品/播放）
  async function parseSelfVideos(file) {
    const sheets = await readWorkbook(file);
    const fileDate = dateFromFilename(file.name);
    const out = [];
    for (const { rows } of sheets) {
      const hi = locateHeaderRow(rows, ["账号", "视频", "播放", "account", "video", "views"]);
      if (hi < 0) continue;
      const headers = rows[hi].map((c) => String(c ?? "").trim());
      const col = {
        date: HEAD(headers, ["日期", "date", "统计日期", "数据日期"]),
        account: HEAD(headers, ["账号", "账号名称", "自营账号", "account", "发布账号"]),
        videoId: HEAD(headers, ["视频 ID", "视频ID", "video id", "videoid", "视频链接", "视频"]),
        productId: HEAD(headers, ["商品 ID", "商品ID", "product id", "挂车商品"]),
        views: HEAD(headers, ["播放量", "播放", "views", "播放次数"]),
        likes: HEAD(headers, ["点赞", "likes"]),
        comments: HEAD(headers, ["评论", "comments"]),
        note: HEAD(headers, ["备注", "note"]),
      };
      if (col.account < 0 && col.videoId < 0) continue;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const account = cleanText(r[col.account]);
        const videoId = cleanId(r[col.videoId]);
        if (!account && !videoId) continue;
        const date = parseAnyDate(r[col.date], { order: "DMY", ref: fileDate }) || fileDate;
        out.push({
          date,
          account,
          videoId,
          productId: cleanId(r[col.productId]),
          views: cleanNum(r[col.views]),
          likes: cleanNum(r[col.likes]),
          comments: cleanNum(r[col.comments]),
          note: cleanText(r[col.note]),
        });
      }
    }
    if (!out.length) throw new Error(`${file.name}：未识别到自营视频行（至少需要 账号 或 视频ID 列）`);
    return { records: out, note: `${out.length} 条自营记录` };
  }

  const DATASETS = {
    adCreatives: { label: "广告 creative data", parser: parseAdCreatives, keyOf: (r) => `${r.store || ""}|${r.date}|${r.campaignId}|${r.creativeType}|${r.videoId || r.productId}`, dateOf: (r) => r.date },
    creatorDaily: { label: "达人订单", parser: parseCreatorDaily, keyOf: (r) => `${r.store || ""}|${r.date}|${r.creator}`, dateOf: (r) => r.date },
    affOrders: { label: "联盟订单", parser: parseAffOrders, keyOf: (r) => `${r.store || ""}|${r.orderId}|${r.skuId}`, dateOf: (r) => r.date },
    samples: { label: "样品订单", parser: parseSamples, keyOf: (r) => `${r.store || ""}|${r.orderId}|${r.skuId}`, dateOf: (r) => r.date },
    affVideos: { label: "全部视频订单", parser: parseAffVideos, keyOf: (r) => `${r.store || ""}|${r.date}|${r.videoId}|${r.productId}`, dateOf: (r) => r.date },
    selfVideos: { label: "自营账号数据", parser: parseSelfVideos, keyOf: (r) => `${r.store || ""}|${r.date}|${r.account}|${r.videoId}`, dateOf: (r) => r.date },
    orders: { label: "订单明细", parser: parseOrderLines, keyOf: (r) => `${r.store || ""}|${r.orderId}|${r.skuId}`, dateOf: (r) => r.date },
  };

  function datasetDates(datasetKey) {
    return [...new Set(scopedRows(datasetKey).map((r) => r.date).filter(isDateKey))].sort();
  }
  function datasetCoverage(datasetKey) {
    const dates = datasetDates(datasetKey);
    return dates.length ? dates[dates.length - 1] : "";
  }

  /* ================= 导入处理 ================= */
  async function handleV33Import(event, datasetKey, statusId, { notify = true } = {}) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const spec = DATASETS[datasetKey];
    const status = document.getElementById(statusId);
    const setStatus = (text, cls) => {
      if (!status) return;
      status.className = `tag ${cls || "tag-yellow"}`;
      status.textContent = text;
    };
    setStatus(`正在解析 ${files.length} 个文件…`, "tag-yellow");
    try {
      const notes = [];
      let parsedCount = 0;
      for (const file of files) {
        const result = await spec.parser(file);
        const merged = new Map((v33[datasetKey] || []).map((r) => [spec.keyOf(r), r]));
        addImportScope(result.records, file.name).forEach((r) => merged.set(spec.keyOf(r), r)); // 同键覆盖，重复导入不双计
        v33[datasetKey] = [...merged.values()];
        invalidateLatestDataDate();
        parsedCount += result.records.length;
        notes.push(`${file.name}：${result.note}`);
      }
      meta.lastImport[datasetKey] = new Date().toISOString();
      await saveV33();
      window.localStorage.setItem("tiktok-real-data-state-v4", "imported");
      window.dispatchEvent(new CustomEvent("real-data-imported"));
      const coverage = datasetCoverage(datasetKey);
      setStatus(`已导入 · 累计 ${v33[datasetKey].length} 条 · 数据至 ${coverage || "?"}`, "tag-green");
      renderAllV33();
      renderFreshnessBadges();
      bridge.renderPriorityPanel();
      if (notify) window.alert(`✅ ${spec.label}导入完成\n\n${notes.join("\n")}\n\n累计存储 ${v33[datasetKey].length} 条（同键自动去重，重复导入不双计）。`);
      return { datasetKey, records: parsedCount, stored: v33[datasetKey].length, notes };
    } catch (error) {
      setStatus("导入失败", "tag-red");
      if (notify) window.alert(`❌ 导入失败\n\n${error.message || "无法识别该文件"}`);
      if (!notify) return { datasetKey, error: error.message || "无法识别该文件" };
    } finally {
      event.target.value = "";
    }
  }

  const UNIFIED_DATASET_LABELS = {
    products: "商品 / 店铺经营",
    creatorDaily: "达人订单",
    affOrders: "联盟订单",
    samples: "样品订单",
    adCreatives: "广告 creative data",
    affVideos: "联盟视频",
    selfVideos: "自营账号视频",
    orders: "订单明细",
  };
  const UNIFIED_DATASET_SIGNATURES = [
    { key: "products", keywords: ["商品 ID", "商品名"] },
    { key: "adCreatives", keywords: ["广告计划名称", "Campaign ID", "Product ID", "Creative type", "成本"] },
    { key: "creatorDaily", keywords: ["达人用户名", "联盟 GMV", "商品曝光次数"] },
    { key: "affOrders", keywords: ["订单 ID", "商品 ID", "达人用户名"] },
    { key: "samples", keywords: ["Order ID", "SKU ID", "Seller SKU"] },
    { key: "orders", keywords: ["Order ID", "Seller SKU", "SKU Subtotal After Discount"] },
    { key: "affVideos", keywords: ["视频 ID", "视频标题", "联盟视频归因 GMV"] },
    { key: "selfVideos", keywords: ["账号", "视频", "播放"] },
  ];
  const UNIFIED_FILENAME_HINTS = [
    { pattern: /product_list/i, key: "products" },
    { pattern: /creative\s*data|campaign/i, key: "adCreatives" },
    { pattern: /creator[_\s-]*list/i, key: "creatorDaily" },
    { pattern: /affiliate[_\s-]*orders/i, key: "affOrders" },
    { pattern: /video[_\s-]*analysis|video[_\s-]*list/i, key: "affVideos" },
    { pattern: /全部.*订单|sample|样品/i, key: "samples" },
    { pattern: /order[_\s-]*sku|ordersku/i, key: "orders" },
  ];

  function signatureScore(rows, keywords) {
    return rows.slice(0, 6).reduce((best, row) => {
      const cells = (row || []).map((cell) => normalizeHeaderText(cell == null ? "" : String(cell)));
      const score = keywords.reduce((total, keyword) => {
        const target = normalizeHeaderText(keyword);
        return total + (cells.some((cell) => cell === target || cell.includes(target)) ? 1 : 0);
      }, 0);
      return Math.max(best, score);
    }, 0);
  }

  function unifiedFilenameHint(fileName) {
    return UNIFIED_FILENAME_HINTS.find((hint) => hint.pattern.test(fileName)) || null;
  }

  async function detectUnifiedDataset(file) {
    const hinted = unifiedFilenameHint(file.name);
    if (hinted) return { key: hinted.key };
    const sheets = await readWorkbook(file);
    const matches = UNIFIED_DATASET_SIGNATURES
      .map((signature) => ({ key: signature.key, score: Math.max(...sheets.map((sheet) => signatureScore(sheet.rows, signature.keywords))) }))
      .filter((match) => match.score >= 2);
    if (!matches.length) return { key: null, reason: "未识别到支持的表头" };
    const bestScore = Math.max(...matches.map((match) => match.score));
    const best = matches.filter((match) => match.score === bestScore);
    if (best.length !== 1) return { key: null, reason: `表头同时符合：${best.map((match) => UNIFIED_DATASET_LABELS[match.key]).join("、")}` };
    return { key: best[0].key };
  }

  async function handleUnifiedImport(event) {
    const files = [...(event.target.files || [])];
    const status = document.getElementById("unified-data-upload-status");
    const setStatus = (text, cls = "tag-yellow") => {
      if (!status) return;
      status.className = `tag ${cls}`;
      status.textContent = text;
    };
    if (!files.length) return;
    setStatus(`正在识别 ${files.length} 个文件…`);
    const groups = new Map();
    const issues = [];
    try {
      for (const file of files) {
        try {
          const detected = await detectUnifiedDataset(file);
          if (!detected.key) {
            issues.push(`${file.name}：${detected.reason}`);
            continue;
          }
          const group = groups.get(detected.key) || [];
          group.push(file);
          groups.set(detected.key, group);
        } catch (error) {
          issues.push(`${file.name}：读取失败（${error.message || "文件格式无法读取"}）`);
        }
      }
      const results = [];
      let importedFileCount = 0;
      const productFiles = groups.get("products") || [];
      if (productFiles.length) {
        try {
          const imported = await bridge.importStoreFiles(productFiles, { notify: false });
          importedFileCount += productFiles.length;
          results.push(`${UNIFIED_DATASET_LABELS.products}：${imported.snapshots.reduce((sum, snapshot) => sum + snapshot.productCount, 0)} 条商品，${productFiles.length} 个文件`);
        } catch (error) {
          issues.push(`商品 / 店铺经营：${error.message || "导入失败"}`);
        }
      }
      for (const [datasetKey, datasetFiles] of groups) {
        if (datasetKey === "products") continue;
        const result = await handleV33Import({ target: { files: datasetFiles, value: "" } }, datasetKey, null, { notify: false });
        if (result && result.error) issues.push(`${UNIFIED_DATASET_LABELS[datasetKey]}：${result.error}`);
        else if (result) {
          importedFileCount += datasetFiles.length;
          results.push(`${UNIFIED_DATASET_LABELS[datasetKey]}：解析 ${result.records} 条，当前累计 ${result.stored} 条，${datasetFiles.length} 个文件`);
        }
      }
      if (!results.length) setStatus("未找到可导入文件", "tag-red");
      else setStatus(`已自动归类 ${importedFileCount} 个文件 · ${issues.length ? `${issues.length} 个需检查` : "全部成功"}`, issues.length ? "tag-yellow" : "tag-green");
      const report = ["✅ 自动归类导入完成", "", ...results];
      if (issues.length) report.push("", "⚠️ 以下文件未导入：", ...issues);
      report.push("", "已保存到当前浏览器，并已刷新对应板块与动态图。");
      window.alert(report.join("\n"));
    } finally {
      event.target.value = "";
    }
  }

  async function handleAssetVideoImport(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    try {
      for (const file of files) await saveVideoBlob(file);
      window.alert(`✅ ${files.length} 个素材视频已保存到本机浏览器\n\n文件名里包含 Video ID 的会自动关联到素材库条目。`);
      renderAssetLibraryV33();
    } catch (e) {
      window.alert(`❌ 视频保存失败\n\n${e.message || "浏览器存储不可用"}`);
    } finally {
      event.target.value = "";
    }
  }

  /* ================= 更新节奏 · 到期提醒 ================= */
  function freshnessState(datasetKey) {
    if (datasetKey === "pricing") {
      const cadence = getCadence("pricing");
      if (!pricing) return { level: "none", text: "待导入", cadence };
      const ref = (pricing.importedAt || "").slice(0, 10);
      return { level: "ok", text: `已导入 ${pricing.skus.length} 个 SKU（${ref}）`, cadence };
    }
    const cadence = getCadence(datasetKey);
    const opt = CADENCE_OPTIONS.find((o) => o.value === cadence) || CADENCE_OPTIONS[2];
    const coverage = datasetCoverage(datasetKey);
    const has = (v33[datasetKey] || []).length > 0 || (datasetKey === "products" && bridgeHasStoreData());
    if (!has) return { level: "none", text: "待导入", cadence };
    let ref = coverage;
    if (datasetKey === "products") {
      const d = bridge.getData();
      const dates = [];
      (d && Array.isArray(d.stores) ? d.stores : []).forEach((s) =>
        (s.snapshots || []).forEach((snap) => { if (snap.imported && isDateKey(snap.reportDate)) dates.push(snap.reportDate); }));
      if (dates.length) ref = dates.sort().pop();
    }
    if (!ref && meta.lastImport[datasetKey]) ref = meta.lastImport[datasetKey].slice(0, 10);
    if (!ref) return { level: "none", text: "待导入", cadence };
    const days = Math.floor((Date.now() - new Date(`${ref}T00:00:00`).getTime()) / 86400000);
    const base = `数据至 ${ref}（${days} 天前）`;
    if (cadence === "free") return { level: "ok", text: base, cadence };
    if (days > opt.over) return { level: "over", text: `${base} · 超期未更`, cadence };
    if (days > opt.warn) return { level: "warn", text: `${base} · 该更新了`, cadence };
    return { level: "ok", text: base, cadence };
  }
  function bridgeHasStoreData() {
    const d = bridge.getData();
    return Boolean(d && Array.isArray(d.stores) && d.stores.some((s) => (s.snapshots || []).some((snap) => snap.imported)));
  }
  function renderFreshnessBadges() {
    document.querySelectorAll("[data-freshness]").forEach((el) => {
      const key = el.getAttribute("data-freshness");
      const state = freshnessState(key);
      const cls = { ok: "tag-green", warn: "tag-yellow", over: "tag-red", none: "tag-gray" }[state.level];
      el.innerHTML = `<span class="tag ${cls}" style="font-size:11px;">${escapeHtml(state.text)}</span>`;
    });
    document.querySelectorAll("select[data-cadence]").forEach((sel) => {
      sel.value = getCadence(sel.getAttribute("data-cadence"));
    });
  }

  /* ================= 广告分析引擎 ================= */
  // 计划命名解析：172*2P(SKU)-手动(模式)-200/12(预算/目标ROI)-0716(建计划日期)-5862(商品后4位)
  function parsePlanName(name, refDate) {
    const s = String(name || "");
    const out = { mode: "", budget: null, targetRoi: null, createdDate: "", productSuffix: "" };
    if (/手动/.test(s)) out.mode = "手动";
    else if (/自动/.test(s)) out.mode = "自动";
    const bp = s.match(/-(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)-/);
    if (bp) { out.budget = Number(bp[1]); out.targetRoi = Number(bp[2]); }
    const dt = s.match(/-(\d{2})(\d{2})-/);
    if (dt && refDate && isDateKey(refDate)) {
      const year = Number(refDate.slice(0, 4));
      let candidate = `${year}-${dt[1]}-${dt[2]}`;
      if (candidate > refDate) candidate = `${year - 1}-${dt[1]}-${dt[2]}`; // 跨年处理
      out.createdDate = candidate;
    }
    const sfx = s.match(/-(\d{3,5})\s*$/);
    if (sfx) out.productSuffix = sfx[1];
    return out;
  }

  function latestAdsDate() { return datasetDates("adCreatives").pop() || ""; }
  function rowsOnDate(datasetKey, date) { return scopedRows(datasetKey).filter((r) => r.date === date); }

  // 计划×日 序列（只有消耗>0或有成交的日子算"在跑"）
  function planDailySeries() {
    const byPlan = new Map();
    scopedRows("adCreatives").forEach((r) => {
      const key = r.campaignId || r.plan;
      if (!key) return;
      const agg = byPlan.get(key) || { campaignId: r.campaignId, plan: r.plan, days: new Map() };
      const d = agg.days.get(r.date) || { spend: 0, revenue: 0, orders: 0 };
      d.spend += r.spend; d.revenue += r.revenue; d.orders += r.orders;
      agg.days.set(r.date, d);
      byPlan.set(key, agg);
    });
    return byPlan;
  }

  // 计划生命周期评估
  function planLifecycle() {
    const T = getThresholds();
    const latest = latestAdsDate();
    if (!latest) return [];
    const out = [];
    planDailySeries().forEach((agg) => {
      const dates = [...agg.days.keys()].sort();
      const metaName = parsePlanName(agg.plan, latest);
      const created = metaName.createdDate || dates[0];
      const age = Math.floor((new Date(`${latest}T00:00:00`) - new Date(`${created}T00:00:00`)) / 86400000);
      const dayList = dates.map((d) => ({ date: d, ...agg.days.get(d), roi: agg.days.get(d).spend > 0 ? agg.days.get(d).revenue / agg.days.get(d).spend : null }));
      const total = dayList.reduce((a, d) => ({ spend: a.spend + d.spend, revenue: a.revenue + d.revenue, orders: a.orders + d.orders }), { spend: 0, revenue: 0, orders: 0 });
      const roi = total.spend > 0 ? total.revenue / total.spend : null;
      const targetRoi = metaName.targetRoi || T.defaultTargetRoi;
      const activeToday = dayList.length && dayList[dayList.length - 1].date === latest && dayList[dayList.length - 1].spend > 0;
      // 连续双降（从最近一个有消耗的日子往前数）
      let streak = 0;
      const activeDays = dayList.filter((d) => d.spend > 0);
      for (let i = activeDays.length - 1; i > 0; i--) {
        const cur = activeDays[i], prev = activeDays[i - 1];
        const roiCur = cur.roi ?? -Infinity, roiPrev = prev.roi ?? -Infinity;
        if (cur.spend < prev.spend && roiCur < roiPrev) streak += 1;
        else break;
      }
      const declineDays = streak ? streak + 1 : 0;
      let stage = "healthy", stageLabel = "健康", advice = "";
      if (age <= T.observeDays) {
        const enoughDays = dayList.length >= T.observeDays;
        if (!enoughDays) {
          stage = "observing"; stageLabel = `观察期 D${Math.min(age + 1, T.observeDays)}/${T.observeDays}`;
          advice = "新计划观察期内，不调不动，等数据。";
        } else {
          const weak = total.spend < T.observeMinSpend || (roi != null && roi < targetRoi);
          if (weak) {
            stage = "kill"; stageLabel = "关停重建";
            const reasons = [];
            if (total.spend < T.observeMinSpend) reasons.push(`${T.observeDays}天累计消耗仅 ${fmtUsd(total.spend)}，消耗没起来`);
            if (roi != null && roi < targetRoi) reasons.push(`ROI ${roi.toFixed(1)} 未达目标 ${targetRoi}`);
            advice = metaName.mode === "自动"
              ? `【${reasons.join("；")}】→ 关停，重建【手动定向】计划，从素材库勾选该商品的优质素材填入。`
              : `【${reasons.join("；")}】→ 关停重建，素材从素材库重新组合。`;
          } else {
            stage = "healthy"; stageLabel = "观察期达标";
          }
        }
      } else if (declineDays >= T.killStreak) {
        stage = "kill"; stageLabel = `连降${declineDays}天·关停`;
        advice = `消耗和ROI已连续 ${declineDays} 天双降，过死刑线（${T.killStreak}天）→ 直接关停重建，重建时从素材库带优质素材。`;
      } else if (declineDays >= T.warnStreak) {
        stage = "warn"; stageLabel = `连降${declineDays}天·预警`;
        advice = `消耗和ROI连续 ${declineDays} 天双降（预警线 ${T.warnStreak} 天，死刑线 ${T.killStreak} 天）→ 准备重建方案，暂不调参。`;
      } else if (!activeToday && dates.length) {
        stage = "idle"; stageLabel = "当日无消耗";
        advice = "最近一天没有消耗（未获探索或已停投）。GMVMax 下属正常，不必干预；若连续多日需要量，再考虑重建。";
        stage = "idle";
      }
      out.push({
        campaignId: agg.campaignId, plan: agg.plan, mode: metaName.mode || "未识别",
        created, age, dayCount: dates.length, total, roi, targetRoi, declineDays,
        stage, stageLabel, advice, activeToday,
        productIds: [...new Set(scopedRows("adCreatives").filter((r) => (r.campaignId || r.plan) === (agg.campaignId || agg.plan)).map((r) => r.productId).filter(Boolean))],
      });
    });
    const order = { kill: 0, warn: 1, observing: 2, healthy: 3, idle: 4 };
    return out.sort((a, b) => order[a.stage] - order[b.stage]);
  }

  // 素材四分层（Video 素材，按最新日期）
  function creativeTiers(date) {
    const T = getThresholds();
    const rows = rowsOnDate("adCreatives", date).filter((r) => r.creativeType === "Video" && r.videoId);
    const tiers = { verified: [], scale: [], watch: [], burn: [] };
    rows.forEach((r) => {
      const roi = r.spend > 0 ? r.revenue / r.spend : (r.orders > 0 ? Infinity : 0);
      const item = { ...r, roi };
      if (r.orders >= 1 && roi >= T.qualityRoi && r.spend >= T.qualityMinSpend) tiers.verified.push(item);
      else if (r.orders >= 1 && roi >= T.qualityRoi) tiers.scale.push(item);
      else if (r.orders >= 1) tiers.watch.push(item);
      else if (r.spend > 0) tiers.burn.push(item);
    });
    tiers.verified.sort((a, b) => b.orders - a.orders);
    tiers.scale.sort((a, b) => b.orders - a.orders);
    tiers.burn.sort((a, b) => b.spend - a.spend);
    return tiers;
  }

  // 商品健康表（按消耗降序）
  function adsProductHealth(date) {
    const rows = rowsOnDate("adCreatives", date);
    const byProduct = new Map();
    rows.forEach((r) => {
      if (!r.productId) return;
      const p = byProduct.get(r.productId) || { productId: r.productId, plans: new Set(), spend: 0, revenue: 0, orders: 0, creatives: 0, videoRevenue: 0, cardRevenue: 0, videoSpend: 0, cardSpend: 0, burnSpend: 0 };
      p.plans.add(r.plan);
      p.spend += r.spend; p.revenue += r.revenue; p.orders += r.orders; p.creatives += 1;
      if (r.creativeType === "Video") { p.videoRevenue += r.revenue; p.videoSpend += r.spend; }
      else { p.cardRevenue += r.revenue; p.cardSpend += r.spend; }
      if (r.orders === 0 && r.spend > 0) p.burnSpend += r.spend;
      byProduct.set(r.productId, p);
    });
    return [...byProduct.values()].map((p) => ({
      ...p,
      planCount: p.plans.size,
      roi: p.spend > 0 ? p.revenue / p.spend : null,
      burnRatio: p.spend > 0 ? p.burnSpend / p.spend : 0,
      videoShare: p.revenue > 0 ? p.videoRevenue / p.revenue : 0,
      videoRoi: p.videoSpend > 0 ? p.videoRevenue / p.videoSpend : null,
      cardRoi: p.cardSpend > 0 ? p.cardRevenue / p.cardSpend : null,
    })).sort((a, b) => b.spend - a.spend);
  }

  // 广告优质达人榜（BD 建联用：按素材成交表现聚合到达人）
  function adsTopCreators(date) {
    const rows = rowsOnDate("adCreatives", date).filter((r) => r.creativeType === "Video" && r.account && r.orders > 0);
    const byCreator = new Map();
    rows.forEach((r) => {
      const c = byCreator.get(r.account) || { account: r.account, gmv: 0, orders: 0, spend: 0, creatives: 0, products: new Set(), videoIds: [] };
      c.gmv += r.revenue; c.orders += r.orders; c.spend += r.spend; c.creatives += 1;
      if (r.productId) c.products.add(r.productId);
      if (r.videoId) c.videoIds.push(r.videoId);
      byCreator.set(r.account, c);
    });
    return [...byCreator.values()]
      .map((c) => ({ ...c, roi: c.spend > 0 ? c.gmv / c.spend : null, productCount: c.products.size }))
      .sort((a, b) => b.gmv - a.gmv);
  }

  /* ================= 优质素材库（自动入库 · 跨天累积 · 只增不覆） ================= */
  // 从全量 adCreatives 推导：Video ID 唯一键，表现跨天累加
  function buildAssetLibrary() {
    const T = getThresholds();
    const latest = latestAdsDate();
    const byVideo = new Map();
    scopedRows("adCreatives").forEach((r) => {
      if (r.creativeType !== "Video" || !r.videoId) return;
      const a = byVideo.get(r.videoId) || {
        videoId: r.videoId, productId: r.productId, account: r.account, timePosted: r.timePosted,
        title: r.title, firstDate: r.date, lastActiveDate: "", cumSpend: 0, cumOrders: 0, cumRevenue: 0, days: 0,
      };
      a.cumSpend += r.spend; a.cumOrders += r.orders; a.cumRevenue += r.revenue; a.days += 1;
      if (r.date < a.firstDate) a.firstDate = r.date;
      if ((r.spend > 0 || r.orders > 0) && (!a.lastActiveDate || r.date > a.lastActiveDate)) a.lastActiveDate = r.date;
      if (!a.productId && r.productId) a.productId = r.productId;
      if (!a.account && r.account) a.account = r.account;
      if (!a.title && r.title) a.title = r.title;
      byVideo.set(r.videoId, a);
    });
    const removed = new Set(meta.removedAssets || []);
    const assets = [];
    byVideo.forEach((a) => {
      if (removed.has(a.videoId)) return;
      const roi = a.cumSpend > 0 ? a.cumRevenue / a.cumSpend : (a.cumOrders > 0 ? Infinity : 0);
      const quality = a.cumOrders >= 1 && roi >= T.qualityRoi;
      const scaleSignal = quality && a.cumSpend < T.qualityMinSpend; // 低消耗高ROI=待放量
      const decayDays = a.lastActiveDate && latest ? Math.floor((new Date(`${latest}T00:00:00`) - new Date(`${a.lastActiveDate}T00:00:00`)) / 86400000) : Infinity;
      const status = decayDays > T.assetDecayDays ? "衰退" : "活跃";
      if (!quality) return; // 只入优质（含待放量信号）
      assets.push({ ...a, roi, tier: scaleSignal ? "待放量" : "已验证", status });
    });
    return assets;
  }
  function assetLibraryByProduct() {
    const byProduct = new Map();
    buildAssetLibrary().forEach((a) => {
      const key = a.productId || "未关联商品";
      if (!byProduct.has(key)) byProduct.set(key, []);
      byProduct.get(key).push(a);
    });
    byProduct.forEach((list) => list.sort((a, b) => (a.status === b.status ? b.cumRevenue - a.cumRevenue : a.status === "活跃" ? -1 : 1)));
    return [...byProduct.entries()].sort((x, y) => {
      const gx = x[1].reduce((s, a) => s + a.cumRevenue, 0), gy = y[1].reduce((s, a) => s + a.cumRevenue, 0);
      return gy - gx;
    });
  }

  /* ================= 广告动作序列（宁少勿多 · 有序执行） ================= */
  function adsActionSequence() {
    const T = getThresholds();
    const latest = latestAdsDate();
    if (!latest) return [];
    const lifecycle = planLifecycle();
    const tiers = creativeTiers(latest);
    const steps = [];
    // ① 止血：关停（死刑计划 + 烧钱素材 TOP）
    lifecycle.filter((p) => p.stage === "kill").forEach((p) => {
      steps.push({
        phase: 1, phaseName: "先止血", icon: "🛑",
        title: `关停重建「${p.plan}」`,
        detail: `${p.stageLabel} · 累计消耗 ${fmtUsd(p.total.spend)} / ROI ${p.roi != null ? p.roi.toFixed(1) : "—"}（目标 ${p.targetRoi}）。${p.advice}`,
      });
    });
    const burnTop = tiers.burn.slice(0, 5);
    if (burnTop.length) {
      const burnTotal = tiers.burn.reduce((s, r) => s + r.spend, 0);
      steps.push({
        phase: 1, phaseName: "先止血", icon: "🔥",
        title: `暂停 ${tiers.burn.length} 条 0 单烧钱素材（当日烧 ${fmtUsd(burnTotal)}）`,
        detail: `TOP：${burnTop.map((r) => `${r.account || "?"} 的 ${r.videoId}（${fmtUsd(r.spend)}）`).join("、")} 等。`,
      });
    }
    // ② 重建/预警
    lifecycle.filter((p) => p.stage === "warn").forEach((p) => {
      steps.push({
        phase: 2, phaseName: "再重建", icon: "⚠️",
        title: `「${p.plan}」连降 ${p.declineDays} 天 · 准备重建`,
        detail: p.advice,
      });
    });
    // ③ 放量：待放量素材 + BD 建联
    if (tiers.scale.length) {
      steps.push({
        phase: 3, phaseName: "后放量", icon: "🚀",
        title: `${tiers.scale.length} 条「待放量」素材可小额加量测试`,
        detail: `消耗不足 ${fmtUsd(T.qualityMinSpend)} 但已出单且 ROI≥${T.qualityRoi}：${tiers.scale.slice(0, 3).map((r) => `${r.account || "?"}(${r.orders}单)`).join("、")} 等。小步加量，跑出来再升级。`,
      });
    }
    const bdTargets = adsTopCreators(latest).filter((c) => c.gmv > 0).slice(0, 3);
    if (bdTargets.length) {
      steps.push({
        phase: 3, phaseName: "后放量", icon: "🤝",
        title: `BD 建联 ${bdTargets.length} 位广告优质达人`,
        detail: bdTargets.map((c) => `${c.account}（${c.orders}单 / GMV ${fmtUsd(c.gmv)}）`).join("、") + "。素材还没怎么花钱就出单，人货匹配好。",
      });
    }
    return steps;
  }

  /* ================= 货币格式化 ================= */
  function adsCurrency() {
    const row = scopedRows("adCreatives").find((r) => r.currency);
    return row ? row.currency : "USD";
  }
  function fmtUsd(v) {
    if (v == null) return "待导入";
    const cur = adsCurrency();
    const sym = cur === "THB" ? "฿" : cur === "CNY" ? "¥" : "$";
    return `${sym}${formatNumber(v, Math.abs(v) >= 100 ? 0 : 2)}`;
  }
  function fmtThb(v) {
    if (v == null) return "待导入";
    return `฿${formatNumber(v, Math.abs(v) >= 100 ? 0 : 2)}`;
  }
  function fmtPct(v) { return v == null ? "待导入" : `${Number(v).toFixed(1)}%`; }

  /* ================= 达人分析引擎 ================= */
  function latestCreatorDate() { return datasetDates("creatorDaily").pop() || ""; }
  function prevCreatorDate() {
    const d = datasetDates("creatorDaily");
    return d.length >= 2 ? d[d.length - 2] : "";
  }
  // 每日三清单：新增动销 / 流失预警 / 连续动销
  function creatorThreeLists() {
    const latest = latestCreatorDate();
    if (!latest) return null;
    const prev = prevCreatorDate();
    const todayRows = rowsOnDate("creatorDaily", latest);
    const prevRows = prev ? rowsOnDate("creatorDaily", prev) : [];
    const prevActive = new Set(prevRows.filter((r) => (r.gmv || 0) > 0).map((r) => r.creator));
    const everActiveBefore = new Set();
    scopedRows("creatorDaily").forEach((r) => {
      if (r.date < latest && (r.gmv || 0) > 0) everActiveBefore.add(r.creator);
    });
    const fresh = [], lost = [], steady = [];
    todayRows.forEach((r) => {
      const gmv = r.gmv || 0;
      if (gmv > 0) {
        if (prevActive.has(r.creator)) steady.push(r);
        else fresh.push(r); // 之前没动销（含全新出现 & 沉默唤醒）
      }
    });
    // 流失：历史动销过，但今天不在名单或0成交
    const todayNames = new Set(todayRows.map((r) => r.creator));
    everActiveBefore.forEach((name) => {
      if (prevActive.has(name) && !todayNames.has(name)) {
        const prevRow = prevRows.find((r) => r.creator === name);
        lost.push({ creator: name, lastGmv: prevRow ? prevRow.gmv : null, lastDate: prev });
      }
    });
    fresh.sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
    lost.sort((a, b) => (b.lastGmv || 0) - (a.lastGmv || 0));
    steady.sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
    return { latest, prev, fresh, lost, steady, todayRows };
  }
  // 动销达人数趋势（北极星）
  function creatorActiveTrend() {
    return datasetDates("creatorDaily").map((d) => ({
      date: d,
      value: rowsOnDate("creatorDaily", d).filter((r) => (r.gmv || 0) > 0).length,
      text: `${rowsOnDate("creatorDaily", d).filter((r) => (r.gmv || 0) > 0).length} 位`,
    }));
  }
  function creatorKpis() {
    const latest = latestCreatorDate();
    if (!latest) return null;
    const rows = rowsOnDate("creatorDaily", latest);
    const active = rows.filter((r) => (r.gmv || 0) > 0);
    const gmv = rows.reduce((s, r) => s + (r.gmv || 0), 0);
    const commission = rows.reduce((s, r) => s + (r.commission || 0), 0);
    const directed = rows.reduce((s, r) => s + (r.directedGmv || 0), 0);
    const T = getThresholds();
    const sorted = [...active].sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
    const topGmv = sorted.slice(0, T.topN).reduce((s, r) => s + (r.gmv || 0), 0);
    const concentration = gmv > 0 ? topGmv / gmv : 0;
    const zeroOut = rows
      .filter((r) => !(r.gmv > 0) && (r.exposure || 0) >= T.exposureZeroMin)
      .sort((a, b) => (b.exposure || 0) - (a.exposure || 0));
    return {
      latest, total: rows.length, activeCount: active.length, gmv, commission,
      commissionRate: gmv > 0 ? commission / gmv : null,
      directedRatio: gmv > 0 ? directed / gmv : null,
      concentration, topNames: sorted.slice(0, T.topN).map((r) => r.creator),
      zeroOut: zeroOut.slice(0, 10),
    };
  }
  // SKU 寄样台账
  function sampleLedger() {
    const bySku = new Map();
    scopedRows("samples").forEach((s) => {
      const key = s.sellerSku || s.skuId || "未知SKU";
      const a = bySku.get(key) || { sellerSku: key, productName: s.productName, total: 0, orders: 0, lastDate: "", byDate: new Map() };
      a.total += s.qty || 0; a.orders += 1;
      if (!a.productName && s.productName) a.productName = s.productName;
      if (s.date && s.date > a.lastDate) a.lastDate = s.date;
      if (s.date) a.byDate.set(s.date, (a.byDate.get(s.date) || 0) + (s.qty || 0));
      bySku.set(key, a);
    });
    const latest = datasetDates("samples").pop() || "";
    return {
      latest,
      rows: [...bySku.values()].sort((a, b) => b.total - a.total),
      todayTotal: latest ? scopedRows("samples").filter((s) => s.date === latest).reduce((x, s) => x + (s.qty || 0), 0) : 0,
    };
  }

  /* ================= 视频分析引擎 ================= */
  function latestVideoDate() { return datasetDates("affVideos").pop() || ""; }
  // 出单视频榜（GPM 优先）
  function videoBoards() {
    const rows = scopedRows("affVideos");
    if (!rows.length) return null;
    const latest = latestVideoDate();
    const dayRows = rowsOnDate("affVideos", latest);
    const selling = dayRows.filter((r) => (r.orders || 0) > 0);
    const byGpm = [...selling].sort((a, b) => (b.gpm || 0) - (a.gpm || 0));
    const byGmv = [...selling].sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
    return {
      latest,
      total: dayRows.length,
      sellingCount: selling.length,
      gmv: selling.reduce((s, r) => s + (r.gmv || 0), 0),
      byGpm: byGpm.slice(0, 15),
      byGmv: byGmv.slice(0, 15),
    };
  }
  // 出单但还没被广告利用的视频（视频模块 × 广告模块的联动）
  function videosNotInAds() {
    const adVideoIds = new Set(scopedRows("adCreatives").map((r) => r.videoId).filter(Boolean));
    const latest = latestVideoDate();
    if (!latest) return [];
    return rowsOnDate("affVideos", latest)
      .filter((r) => (r.orders || 0) > 0 && r.videoId && !adVideoIds.has(r.videoId))
      .sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
  }
  // 自营账号拼接：前台播放 + 联盟归因 GMV
  function selfVideoRows() {
    const byVideoId = new Map();
    const affVideos = scopedRows("affVideos");
    const selfVideos = scopedRows("selfVideos");
    affVideos.forEach((r) => { if (r.videoId) byVideoId.set(r.videoId, r); });
    const selfAccounts = new Set(selfVideos.map((r) => r.account).filter(Boolean));
    // 自营上传的记录
    const rows = selfVideos.map((r) => {
      const hit = r.videoId && byVideoId.get(r.videoId);
      return { ...r, gmv: hit ? hit.gmv : null, orders: hit ? hit.orders : null, matched: Boolean(hit) };
    });
    // 联盟视频里属于自营账号的（账号名匹配）
    const extra = affVideos.filter((r) => r.creator && selfAccounts.has(r.creator) && !selfVideos.some((s) => s.videoId === r.videoId));
    return { rows, extra, accounts: [...selfAccounts] };
  }

  /* ================= 商品四象限 + 集中度（数据来自 product_list + 联盟订单推导） ================= */
  function productQuadrants() {
    const data = bridge.getData();
    if (!data || !Array.isArray(data.stores)) return null;
    const products = new Map();
    data.stores.forEach((store) => {
      const snaps = (store.snapshots || []).filter((s) => isDateKey(s.reportDate));
      if (!snaps.length) return;
      const latestSnap = snaps.sort((a, b) => a.reportDate.localeCompare(b.reportDate)).pop();
      (latestSnap.products || []).forEach((p) => {
        if (!p.id) return;
        const prev = products.get(p.id);
        // 多店铺同商品合并（曝光/点击/订单求和）
        const agg = prev || { id: p.id, name: p.name, exposure: 0, clicks: 0, orders: 0, gmv: 0, hasExposure: false, hasClicks: false };
        if (p.exposure != null) { agg.exposure += p.exposure; agg.hasExposure = true; }
        if (p.clicks != null) { agg.clicks += p.clicks; agg.hasClicks = true; }
        if (p.orders != null) agg.orders += p.orders;
        if (p.gmv != null) agg.gmv += p.gmv;
        products.set(p.id, agg);
      });
    });
    const list = [...products.values()].map((p) => ({
      ...p,
      cvr: p.hasClicks && p.clicks > 0 ? p.orders / p.clicks : null,
    })).filter((p) => p.hasExposure && p.cvr != null);
    if (list.length < 4) return null;
    const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const medExposure = med(list.map((p) => p.exposure));
    const medCvr = med(list.map((p) => p.cvr));
    // 集中度：每商品动销达人数（联盟订单推导）
    const sellersByProduct = new Map();
    scopedRows("affOrders").forEach((o) => {
      if (!o.productId || !o.creator || !(o.qty > 0)) return;
      if (!sellersByProduct.has(o.productId)) sellersByProduct.set(o.productId, new Set());
      sellersByProduct.get(o.productId).add(o.creator);
    });
    const quad = { star: [], traffic: [], convert: [], drop: [] };
    list.forEach((p) => {
      const hiE = p.exposure >= medExposure, hiC = p.cvr >= medCvr;
      const item = { ...p, sellers: sellersByProduct.get(p.id) ? sellersByProduct.get(p.id).size : null };
      if (hiE && hiC) quad.star.push(item);
      else if (!hiE && hiC) quad.traffic.push(item);   // 低曝高转 → 加流量
      else if (hiE && !hiC) quad.convert.push(item);  // 高曝低转 → 优化承接
      else quad.drop.push(item);                      // 双低 → 收缩
    });
    Object.values(quad).forEach((q) => q.sort((a, b) => b.gmv - a.gmv));
    // 集中度预警：GMV 头部但动销达人 ≤2
    const concentrated = list
      .filter((p) => p.gmv > 0)
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 15)
      .map((p) => ({ ...p, sellers: sellersByProduct.get(p.id) ? sellersByProduct.get(p.id).size : null }))
      .filter((p) => p.sellers != null && p.sellers <= 2);
    return { medExposure, medCvr, quad, concentrated, hasOrders: scopedRows("affOrders").length > 0 };
  }

  /* ================= 交叉诊断引擎（商品ID 主轴 · 全模块取证） ================= */
  function crossDiagnose(productId) {
    const latest = latestAdsDate();
    const evidence = [];
    // ① 商品侧（product_list 趋势）
    const trend = collectProductTrendSafe(productId);
    if (trend && trend.points.length >= 2) {
      const a = trend.points[trend.points.length - 2], b = trend.points[trend.points.length - 1];
      const pct = (x, y) => (x ? `${(((y - x) / x) * 100).toFixed(0)}%` : "—");
      evidence.push({
        module: "商品", ok: true,
        text: `${b.date} vs ${a.date}：曝光 ${pct(a.exposure, b.exposure)}（${formatCompact(a.exposure)}→${formatCompact(b.exposure)}），GMV ${pct(a.gmv, b.gmv)}，CTR ${a.exposure ? (a.clicks / a.exposure * 100).toFixed(2) : "?"}%→${b.exposure ? (b.clicks / b.exposure * 100).toFixed(2) : "?"}%`,
      });
    } else {
      evidence.push({ module: "商品", ok: false, text: "商品快照不足 2 天，无法计算趋势" });
    }
    // ② 广告侧
    const scopedAdRows = scopedRows("adCreatives");
    const adRows = scopedAdRows.filter((r) => r.productId === productId);
    if (adRows.length) {
      const latestRows = adRows.filter((r) => r.date === latest);
      const spend = latestRows.reduce((s, r) => s + r.spend, 0);
      const revenue = latestRows.reduce((s, r) => s + r.revenue, 0);
      const burn = latestRows.filter((r) => r.spend > 0 && r.orders === 0);
      const burnSpend = burn.reduce((s, r) => s + r.spend, 0);
      const videoRows = latestRows.filter((r) => r.creativeType === "Video");
      evidence.push({
        module: "广告", ok: true,
        text: `${latest}：${latestRows.length} 条素材在跑（Video ${videoRows.length}），消耗 ${fmtUsd(spend)}，ROI ${spend > 0 ? (revenue / spend).toFixed(1) : "—"}，0单烧钱 ${fmtUsd(burnSpend)}（${spend > 0 ? Math.round(burnSpend / spend * 100) : 0}%）`,
      });
    } else {
      evidence.push({ module: "广告", ok: false, text: scopedAdRows.length ? "该商品近期无广告消耗（广告断供？）" : "广告模块未导入，无法验证" });
    }
    // ③ 视频侧
    const scopedAffVideos = scopedRows("affVideos");
    const vRows = scopedAffVideos.filter((r) => r.productId === productId);
    if (vRows.length) {
      const vLatest = latestVideoDate();
      const dayRows = vRows.filter((r) => r.date === vLatest);
      const selling = dayRows.filter((r) => (r.orders || 0) > 0);
      evidence.push({
        module: "视频", ok: true,
        text: `${vLatest}：${dayRows.length} 条联盟视频在档，${selling.length} 条出单，视频GMV ${fmtThb(selling.reduce((s, r) => s + (r.gmv || 0), 0))}${selling.length ? "" : "（出单断供）"}`,
      });
    } else {
      evidence.push({ module: "视频", ok: false, text: scopedAffVideos.length ? "该商品近期无联盟视频数据" : "视频模块未导入，无法验证" });
    }
    // ④ 达人侧（联盟订单推导该商品的动销达人）
    const scopedAffOrders = scopedRows("affOrders");
    const oRows = scopedAffOrders.filter((r) => r.productId === productId && (r.qty || 0) > 0);
    if (oRows.length) {
      const sellers = new Set(oRows.map((r) => r.creator).filter(Boolean));
      const dates = [...new Set(oRows.map((r) => r.date).filter(isDateKey))].sort();
      const lastD = dates.pop();
      const todaySellers = new Set(oRows.filter((r) => r.date === lastD).map((r) => r.creator).filter(Boolean));
      evidence.push({
        module: "达人", ok: true,
        text: `${lastD}：${todaySellers.size} 位达人在带（累计 ${sellers.size} 位）${todaySellers.size <= 2 ? "，⚠️ 集中度高" : ""}`,
      });
    } else {
      evidence.push({ module: "达人", ok: false, text: scopedAffOrders.length ? "该商品近期无达人出单" : "联盟订单未导入，无法验证" });
    }
    return evidence;
  }
  function collectProductTrendSafe(productId) {
    try {
      const data = bridge.getData();
      if (!data || !Array.isArray(data.stores)) return null;
      const byDate = new Map();
      data.stores.forEach((store) => {
        (store.snapshots || []).forEach((snap) => {
          if (!isDateKey(snap.reportDate)) return;
          const p = (snap.products || []).find((item) => item.id === productId);
          if (!p) return;
          const pt = byDate.get(snap.reportDate) || { date: snap.reportDate, gmv: 0, exposure: 0, clicks: 0, orders: 0 };
          pt.gmv += p.gmv || 0; pt.exposure += p.exposure || 0; pt.clicks += p.clicks || 0; pt.orders += p.orders || 0;
          byDate.set(snap.reportDate, pt);
        });
      });
      const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
      return { points };
    } catch (e) { return null; }
  }

  /* ================= 渲染工具 ================= */
  function emptyBlock(html) { return `<div class="ops-empty">${html}</div>`; }
  function sparkChart(points, color) {
    const valid = points.filter((p) => p.value != null);
    if (valid.length < 2) return `<div style="font-size:12px;color:#94a3b8;padding:14px 0;text-align:center;">快照不足，至少 2 个日期出趋势</div>`;
    const width = 320, height = 100, padX = 8, padTop = 12, padBottom = 18;
    const values = valid.map((p) => p.value);
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const stepX = (width - padX * 2) / (valid.length - 1);
    const coords = valid.map((p, i) => [padX + i * stepX, padTop + (1 - (p.value - min) / span) * (height - padTop - padBottom)]);
    const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const dots = coords.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${color}"><title>${valid[i].date}: ${valid[i].text || valid[i].value}</title></circle>`).join("");
    const labels = valid.map((p, i) => {
      if (valid.length > 4 && i % Math.ceil(valid.length / 4) !== 0 && i !== valid.length - 1) return "";
      return `<text x="${coords[i][0].toFixed(1)}" y="${height - 5}" font-size="8" fill="#94a3b8" text-anchor="middle">${p.date.slice(5)}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${width} ${height}" role="img"><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}</svg>`;
  }
  function kpiCard(label, value, sub, color) {
    return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value" ${color ? `style="color:${color};"` : ""}>${value}</div><div class="stat-trend">${sub || ""}</div></div>`;
  }

  /* ================= GMVMax Product ID 核心分析（原生模块） ================= */
  function renderGmvmaxProductIdPanelV33(inputRows) {
    const panel = document.getElementById("gmvmax-product-id-panel");
    if (!panel) return;
    const rows = (Array.isArray(inputRows) ? inputRows : []).filter((row) => row && typeof row === "object");
    const waiting = "待导入";
    const money = (value, available = true) => available && Number.isFinite(Number(value)) ? fmtUsd(Number(value)) : waiting;
    const count = (value, available = true) => available && Number.isFinite(Number(value)) ? formatCompact(Number(value)) : waiting;
    const kpi = (label, value, color) => `<div class="gmvmax-product-kpi"><div class="gmvmax-product-kpi-label">${label}</div><div class="gmvmax-product-kpi-value ${color || ""}">${value}</div></div>`;
    const typeOf = (row) => /video|视频|短视频|素材|creative/i.test(String(row.creativeType || "")) ? "video" : "card";
    const structure = (title, spend, orders, gmv, color, hasRows, totalGmv) => {
      const spendValue = hasRows ? money(spend) : waiting;
      const orderValue = hasRows ? `${count(orders)}单` : waiting;
      const gmvValue = hasRows ? money(gmv) : waiting;
      const roi = hasRows && spend > 0 ? `${(gmv / spend).toFixed(2)}x` : waiting;
      const share = hasRows && totalGmv > 0 ? `${(gmv / totalGmv * 100).toFixed(1)}%` : waiting;
      return `<div class="gmvmax-product-structure-card"><div class="gmvmax-product-structure-title">${title}</div><div class="gmvmax-product-structure-value ${color}">${spendValue}</div><div class="gmvmax-product-structure-detail">消耗 · ${orderValue} · GMV ${gmvValue}<br>ROI <strong>${roi}</strong> · 成交占比 <strong>${share}</strong></div></div>`;
    };
    const emptyKpis = [
      kpi("总消耗", waiting, "gmvmax-product-blue"), kpi("总GMV", waiting, "gmvmax-product-green"),
      kpi("整体ROI", waiting, "gmvmax-product-green"), kpi("总订单", waiting, "gmvmax-product-orange"),
      kpi("有消耗商品", waiting, "gmvmax-product-blue"), kpi("优质Video素材", waiting, "gmvmax-product-red"),
      kpi("0单烧钱素材", waiting, "gmvmax-product-orange"), kpi("出单达人", waiting, "gmvmax-product-blue"),
    ].join("");
    if (!rows.length) {
      panel.innerHTML = `<div class="gmvmax-view-section"><div class="gmvmax-view-section-title">一、Product ID 核心视角 <small>按商品 Product ID 聚合</small></div><div class="gmvmax-product-kpis">${emptyKpis}</div><div class="gmvmax-product-empty" style="margin-top:10px;">暂无广告数据。到「数据接入」导入 GMVMax creative data 后，这里会自动生成 Product ID 级汇总。</div></div><div class="gmvmax-view-section"><div class="gmvmax-view-section-title">二、Video vs Product card 核心结构 <small>成交来源拆分</small></div><div class="gmvmax-product-structure">${structure("Video 素材", 0, 0, 0, "gmvmax-product-blue", false, 0)}${structure("Product card 商品卡", 0, 0, 0, "gmvmax-product-green", false, 0)}</div><div class="gmvmax-product-empty">导入素材类型、订单、消耗和 GMV 字段后，自动比较 Video 素材与 Product card 商品卡的消耗、订单、GMV、ROI 和成交占比。</div></div><div class="gmvmax-view-section"><div class="gmvmax-view-section-title">三、核心发现 <small>由当前广告数据生成</small></div><div class="gmvmax-product-findings"><ol><li><span class="gmvmax-product-tag gmvmax-product-tag-yellow">等待数据</span>当前没有可分析的广告记录。</li><li><span class="gmvmax-product-tag gmvmax-product-tag-blue">导入后生成</span>系统会识别 Product ID、Video ID、达人账号和素材类型。</li><li><span class="gmvmax-product-tag gmvmax-product-tag-green">不编数据</span>缺失字段会显示“待导入”，不会使用固定测试数字。</li></ol></div></div>`;
      return;
    }
    const totalSpend = rows.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
    const totalGmv = rows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
    const totalOrders = rows.reduce((sum, row) => sum + (Number(row.orders) || 0), 0);
    const totalRoi = totalSpend > 0 ? totalGmv / totalSpend : null;
    const videoRows = rows.filter((row) => typeOf(row) === "video");
    const cardRows = rows.filter((row) => typeOf(row) === "card");
    const aggregate = (list, field) => list.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
    const videoSpend = aggregate(videoRows, "spend");
    const cardSpend = aggregate(cardRows, "spend");
    const videoGmv = aggregate(videoRows, "revenue");
    const cardGmv = aggregate(cardRows, "revenue");
    const videoOrders = aggregate(videoRows, "orders");
    const cardOrders = aggregate(cardRows, "orders");
    const productRows = rows.filter((row) => row.productId);
    const productMap = new Map();
    rows.forEach((row) => {
      const id = String(row.productId || "未标注商品");
      const item = productMap.get(id) || { id, spend: 0, gmv: 0, orders: 0, records: 0, zeroSpend: 0 };
      item.spend += Number(row.spend) || 0;
      item.gmv += Number(row.revenue) || 0;
      item.orders += Number(row.orders) || 0;
      item.records += 1;
      if ((Number(row.orders) || 0) === 0 && (Number(row.spend) || 0) > 0) item.zeroSpend += Number(row.spend) || 0;
      productMap.set(id, item);
    });
    const products = [...productMap.values()].sort((a, b) => b.spend - a.spend);
    const T = getThresholds();
    const qualityVideoRows = videoRows.filter((row) => {
      const spend = Number(row.spend) || 0;
      const gmv = Number(row.revenue) || 0;
      const orders = Number(row.orders) || 0;
      return spend >= T.qualityMinSpend && orders > 0 && spend > 0 && gmv / spend >= T.qualityRoi;
    }).sort((a, b) => (Number(b.orders) || 0) - (Number(a.orders) || 0));
    const qualityVideoCount = new Set(qualityVideoRows.map((row) => row.videoId).filter(Boolean)).size || qualityVideoRows.length;
    const zeroOrderRows = rows.filter((row) => (Number(row.spend) || 0) > 0 && (Number(row.orders) || 0) === 0);
    const creatorMap = new Map();
    rows.filter((row) => row.account && ((Number(row.orders) || 0) > 0 || (Number(row.revenue) || 0) > 0)).forEach((row) => {
      const name = String(row.account);
      const item = creatorMap.get(name) || { account: name, gmv: 0, orders: 0 };
      item.gmv += Number(row.revenue) || 0;
      item.orders += Number(row.orders) || 0;
      creatorMap.set(name, item);
    });
    const creators = [...creatorMap.values()].sort((a, b) => b.gmv - a.gmv);
    const productSummary = products.slice(0, 10).map((item, index) => `<tr><td>${index + 1}</td><td class="l"><strong>${escapeHtml(item.id)}</strong></td><td>${money(item.spend)}</td><td>${count(item.orders)}</td><td>${money(item.gmv)}</td><td>${item.spend > 0 ? `${(item.gmv / item.spend).toFixed(2)}x` : waiting}</td><td>${item.records}</td></tr>`).join("");
    const rankRows = (items, title, value) => `<div class="gmvmax-product-rank"><div class="gmvmax-product-rank-title">${title}</div>${items.length ? items.slice(0, 5).map((item, index) => `<div class="gmvmax-product-rank-row"><span class="gmvmax-product-rank-name">${index + 1}. ${escapeHtml(String(item.label))}</span><span class="gmvmax-product-rank-value">${value(item)}</span></div>`).join("") : `<div class="gmvmax-product-empty">暂无可展示记录</div>`}</div>`;
    const findings = [];
    const bestProduct = products.find((item) => item.gmv > 0) || products[0];
    if (bestProduct) findings.push(`<li><span class="gmvmax-product-tag gmvmax-product-tag-green">Product ID</span>${escapeHtml(bestProduct.id)} 当前消耗 ${money(bestProduct.spend)}、GMV ${money(bestProduct.gmv)}，ROI ${bestProduct.spend > 0 ? `${(bestProduct.gmv / bestProduct.spend).toFixed(2)}x` : waiting}。</li>`);
    if (videoGmv + cardGmv > 0) {
      const leader = videoGmv >= cardGmv ? "Video 素材" : "Product card 商品卡";
      findings.push(`<li><span class="gmvmax-product-tag gmvmax-product-tag-blue">结构</span>${leader}贡献的 GMV 更高；Video ${money(videoGmv)}，商品卡 ${money(cardGmv)}，可据此安排素材与商品卡的预算复核。</li>`);
    }
    if (zeroOrderRows.length) findings.push(`<li><span class="gmvmax-product-tag gmvmax-product-tag-red">止损</span>发现 ${zeroOrderRows.length} 条有消耗 0 单记录，累计消耗 ${money(aggregate(zeroOrderRows, "spend"))}，建议优先核查。</li>`);
    if (!productRows.length) findings.push(`<li><span class="gmvmax-product-tag gmvmax-product-tag-yellow">字段提示</span>当前广告记录没有可识别的 Product ID，商品级分析暂时只能显示未标注商品。</li>`);
    if (!findings.length) findings.push(`<li><span class="gmvmax-product-tag gmvmax-product-tag-yellow">字段提示</span>已导入广告记录，但暂未形成可解释的 Product ID、素材或成交结论。</li>`);
    const qualityItems = qualityVideoRows.map((row) => ({ label: row.videoId || row.title || row.productId || "未标注素材", orders: Number(row.orders) || 0 }));
    const burnItems = products.filter((item) => item.zeroSpend > 0).map((item) => ({ label: item.id, spend: item.zeroSpend }));
    const creatorItems = creators.map((item) => ({ label: item.account, gmv: item.gmv }));
    panel.innerHTML = `<div class="gmvmax-view-section"><div class="gmvmax-view-section-title">一、Product ID 核心视角 <small>按商品 Product ID 聚合 · 已导入广告数据</small></div><div class="gmvmax-product-kpis">${kpi("总消耗", money(totalSpend), "gmvmax-product-blue")}${kpi("总GMV", money(totalGmv), "gmvmax-product-green")}${kpi("整体ROI", totalRoi != null ? `${totalRoi.toFixed(2)}x` : waiting, "gmvmax-product-green")}${kpi("总订单", count(totalOrders), "gmvmax-product-orange")}${kpi("有消耗商品", `${new Set(productRows.map((row) => row.productId).filter(Boolean)).size}个`, "gmvmax-product-blue")}${kpi("优质Video素材", `${qualityVideoCount}条`, "gmvmax-product-red")}${kpi("0单烧钱素材", `${zeroOrderRows.length}条`, "gmvmax-product-orange")}${kpi("出单达人", `${creators.length}个`, "gmvmax-product-blue")}</div><div class="gmvmax-product-table"><div class="gmvmax-product-table-title">Product ID 级汇总 <span class="gmvmax-product-table-note">按消耗降序 · 展示前10条</span></div><div class="desktop-table-wrap"><table class="desktop-table"><thead><tr><th>#</th><th>Product ID</th><th>消耗</th><th>订单</th><th>GMV</th><th>ROI</th><th>记录数</th></tr></thead><tbody>${productSummary || `<tr><td colspan="7" class="real-empty-cell">暂无可识别的 Product ID</td></tr>`}</tbody></table></div></div></div><div class="gmvmax-view-section"><div class="gmvmax-view-section-title">二、Video vs Product card 核心结构 <small>成交来源拆分</small></div><div class="gmvmax-product-structure">${structure("Video 素材", videoSpend, videoOrders, videoGmv, "gmvmax-product-blue", videoRows.length > 0, totalGmv)}${structure("Product card 商品卡", cardSpend, cardOrders, cardGmv, "gmvmax-product-green", cardRows.length > 0, totalGmv)}</div><div class="gmvmax-product-ranks">${rankRows(qualityItems, "① 优质Video素材", (item) => `${count(item.orders)}单`)}${rankRows(burnItems, "② 0单烧钱排行", (item) => money(item.spend))}${rankRows(creatorItems, "③ 达人成交排行", (item) => money(item.gmv))}</div></div><div class="gmvmax-view-section"><div class="gmvmax-view-section-title">三、核心发现 <small>由当前广告数据生成</small></div><div class="gmvmax-product-findings"><ol>${findings.join("")}</ol></div></div>`;
  }
  /* ================= 渲染：广告页 ================= */
  function renderAdsPageV33() {
    const kpiEl = document.getElementById("ads-kpi-row");
    const lifeEl = document.getElementById("ads-lifecycle-panel");
    const seqEl = document.getElementById("ads-action-seq-panel");
    const healthEl = document.getElementById("ads-product-health-panel");
    const boardsEl = document.getElementById("ads-creative-boards");
    const gmvmaxEl = document.getElementById("gmvmax-product-id-panel");
    if (!kpiEl && !lifeEl && !boardsEl && !gmvmaxEl) return;
    const adRowsInScope = scopedRows("adCreatives");
    if (!adRowsInScope.length) {
      const guide = emptyBlock(`<b>广告数据待导入。</b>到「数据接入」页上传 GMVMax creative data 导出表（原样直传，系统自动滤掉零消耗素材池行）。导入后这里出现：计划生命周期、素材四分层、商品健康表、今日动作清单。`);
      if (kpiEl) kpiEl.innerHTML = "";
      if (lifeEl) lifeEl.innerHTML = guide;
      if (seqEl) seqEl.innerHTML = "";
      if (healthEl) healthEl.innerHTML = "";
      if (boardsEl) boardsEl.innerHTML = "";
      if (gmvmaxEl) renderGmvmaxProductIdPanelV33([]);
      return;
    }
    if (gmvmaxEl) renderGmvmaxProductIdPanelV33(adRowsInScope);
    const T = getThresholds();
    const latest = latestAdsDate();
    const rows = rowsOnDate("adCreatives", latest);
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const orders = rows.reduce((s, r) => s + r.orders, 0);
    const burn = rows.filter((r) => r.spend > 0 && r.orders === 0);
    const burnSpend = burn.reduce((s, r) => s + r.spend, 0);
    const tiers = creativeTiers(latest);
    const lifecycle = planLifecycle();
    const killCount = lifecycle.filter((p) => p.stage === "kill").length;
    const warnCount = lifecycle.filter((p) => p.stage === "warn").length;

    if (kpiEl) {
      kpiEl.innerHTML =
        kpiCard("当日消耗", fmtUsd(spend), latest, "") +
        kpiCard("当日 GMV", fmtUsd(revenue), `订单 ${orders}`, "#059669") +
        kpiCard("整体 ROI", spend > 0 ? `${(revenue / spend).toFixed(2)}x` : "—", "消耗口径", spend > 0 && revenue / spend >= T.defaultTargetRoi ? "#059669" : "#d97706") +
        kpiCard("0单烧钱", `${fmtUsd(burnSpend)}`, `${burn.length} 条素材 · 占消耗 ${spend > 0 ? Math.round(burnSpend / spend * 100) : 0}%`, burnSpend / (spend || 1) > 0.4 ? "#dc2626" : "#d97706") +
        kpiCard("优质素材", `${tiers.verified.length + tiers.scale.length} 条`, `已验证 ${tiers.verified.length} · 待放量 ${tiers.scale.length}`, "#2563eb");
    }

    // 计划生命周期
    if (lifeEl) {
      const tagOf = { kill: "tag-red", warn: "tag-yellow", observing: "tag-blue", healthy: "tag-green", idle: "tag-gray" };
      const rowsHtml = lifecycle.map((p) => `<tr>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(p.plan)}"><strong>${escapeHtml(p.plan)}</strong><br><span style="font-size:11px;color:#94a3b8;">${escapeHtml(p.mode)} · 建于 ${p.created} · ${p.age}天</span></td>
        <td><span class="tag ${tagOf[p.stage]}">${p.stageLabel}</span></td>
        <td>${fmtUsd(p.total.spend)}</td>
        <td>${p.roi != null ? p.roi.toFixed(1) : "—"} / ${p.targetRoi}</td>
        <td style="font-size:12px;color:#475569;max-width:380px;">${escapeHtml(p.advice || "—")}</td>
      </tr>`).join("");
      lifeEl.innerHTML = `<div class="desktop-table-wrap"><table class="desktop-table">
        <thead><tr><th>计划</th><th>阶段</th><th>累计消耗</th><th>ROI/目标</th><th>建议</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table></div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">规则：新计划观察 ${T.observeDays} 天不动 → 消耗&lt;${fmtUsd(T.observeMinSpend)} 或 ROI&lt;目标 关停重建；老计划消耗&amp;ROI 连降 ${T.warnStreak} 天预警、${T.killStreak} 天关停。模式/目标ROI/建计划日期从命名解析（如 172*2P-手动-200/12-0716-5862），命名不含则显示"未识别"。<button class="ops-chip" id="ads-threshold-btn" style="margin-left:8px;">⚙️ 阈值设置</button></div>`;
      const btn = lifeEl.querySelector("#ads-threshold-btn");
      if (btn) btn.addEventListener("click", openThresholdSettings);
    }

    // 动作序列
    if (seqEl) {
      const steps = adsActionSequence();
      if (!steps.length) {
        seqEl.innerHTML = emptyBlock("今日无必须动作：没有死刑计划、烧钱可控、无待放量信号。👍");
      } else {
        let lastPhase = 0;
        seqEl.innerHTML = steps.map((s, i) => {
          const phaseHead = s.phase !== lastPhase ? `<div style="font-size:12px;font-weight:700;color:#0f172a;margin:${i ? "12px" : "0"} 0 8px;">${s.icon} 第${["", "一", "二", "三"][s.phase]}步 · ${s.phaseName}</div>` : "";
          lastPhase = s.phase;
          return `${phaseHead}<div class="priority-item sev-${s.phase === 1 ? "high" : s.phase === 2 ? "medium" : "good"}">
            <div class="priority-item-title">${escapeHtml(s.title)}</div>
            <div class="priority-item-body">${escapeHtml(s.detail)}</div>
          </div>`;
        }).join("") + `<div style="font-size:12px;color:#64748b;margin-top:8px;">动作按「止血→重建→放量」排序，宁少勿多。执行完今天的事就停手——GMVMax 调得越多效果越差。</div>`;
      }
    }

    // 商品健康表
    if (healthEl) {
      const health = adsProductHealth(latest);
      const rowsHtml = health.map((p) => `<tr>
        <td style="font-family:monospace;font-size:11px;">${escapeHtml(p.productId)}</td>
        <td>${fmtUsd(p.spend)}</td>
        <td>${p.orders}</td>
        <td>${fmtUsd(p.revenue)}</td>
        <td style="font-weight:600;${p.roi != null && p.roi < T.defaultTargetRoi ? "color:#dc2626;" : "color:#059669;"}">${p.roi != null ? p.roi.toFixed(1) : "—"}</td>
        <td class="${p.burnRatio > 0.5 ? "bad" : ""}" style="${p.burnRatio > 0.5 ? "color:#dc2626;font-weight:600;" : ""}">${Math.round(p.burnRatio * 100)}%</td>
        <td>${p.creatives}</td>
        <td style="font-size:12px;">视频 ${Math.round(p.videoShare * 100)}% / 卡 ${Math.round((1 - p.videoShare) * 100)}%</td>
        <td style="font-size:12px;">${p.videoRoi != null ? `V ${p.videoRoi.toFixed(1)}` : "—"} · ${p.cardRoi != null ? `卡 ${p.cardRoi.toFixed(1)}` : "—"}</td>
      </tr>`).join("");
      healthEl.innerHTML = `<div class="desktop-table-wrap"><table class="desktop-table">
        <thead><tr><th>商品 ID</th><th>消耗</th><th>订单</th><th>GMV</th><th>ROI</th><th>0单烧钱%</th><th>素材数</th><th>Video/卡结构</th><th>分轨ROI</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table></div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">按消耗降序 · 0单烧钱% &gt; 50% 标红（Video 素材全停、只留商品卡的信号）· Video ROI 远低于卡 ROI 的商品考虑预算转商品卡。</div>`;
    }

    // 素材双榜 + 达人榜
    if (boardsEl) {
      const itemRow = (r, idx, metric) => `<div class="lb-row">
        <span class="lb-rank">${idx + 1}</span>
        <span class="lb-name" title="${escapeHtml(r.title || r.videoId)}">${escapeHtml(r.account || "—")}</span>
        <span class="lb-sub">${escapeHtml(r.videoId)} · ${escapeHtml(r.plan || "")}</span>
        <span class="lb-value">${metric(r)}</span>
      </div>`;
      const creators = adsTopCreators(latest);
      boardsEl.innerHTML = `<div class="real-ranking-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="real-ranking-card gmv">
          <div class="real-ranking-title">⭐ 优质素材榜（复制对象）</div>
          <div class="real-ranking-subtitle">有单 且 ROI≥${T.qualityRoi} · 按订单降序（含待放量标记）</div>
          ${tiers.verified.length + tiers.scale.length ? `<div class="lb-list">${[...tiers.verified, ...tiers.scale].slice(0, 10).map((r, i) => itemRow(r, i, (x) => `${x.orders}单 · ROI ${x.roi === Infinity ? "∞" : x.roi.toFixed(1)}${x.spend < T.qualityMinSpend ? ' <span class="tag tag-blue" style="font-size:10px;">待放量</span>' : ""}`)).join("")}</div>` : emptyBlock("今日无优质素材。")}
        </div>
        <div class="real-ranking-card" style="border-top-color:#dc2626;">
          <div class="real-ranking-title">🔥 0单烧钱榜（关停对象）</div>
          <div class="real-ranking-subtitle">有消耗 0 订单 · 按烧钱金额降序（共 ${tiers.burn.length} 条 / ${fmtUsd(tiers.burn.reduce((s, r) => s + r.spend, 0))}）</div>
          ${tiers.burn.length ? `<div class="lb-list">${tiers.burn.slice(0, 10).map((r, i) => itemRow(r, i, (x) => `烧 ${fmtUsd(x.spend)}`)).join("")}</div>` : emptyBlock("今日无烧钱素材。👍")}
        </div>
        <div class="real-ranking-card up">
          <div class="real-ranking-title">🤝 广告优质达人榜（BD 建联）</div>
          <div class="real-ranking-subtitle">按素材成交 GMV 降序 · 拿去做定向建联</div>
          ${creators.length ? `<div class="lb-list">${creators.slice(0, 10).map((c, i) => `<div class="lb-row">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-name">${escapeHtml(c.account)}</span>
            <span class="lb-sub">${c.creatives}条素材 · ${c.productCount}个品</span>
            <span class="lb-value">${c.orders}单 · ${fmtUsd(c.gmv)}</span>
          </div>`).join("")}</div>` : emptyBlock("今日无出单达人。")}
        </div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#64748b;">统计日期 ${latest} · 观察层（有单但 ROI&lt;${T.qualityRoi}）共 ${tiers.watch.length} 条不进榜，继续跑。</div>`;
    }
  }

  // 素材库（商品ID 子表 + 一键复制）
  async function renderAssetLibraryV33() {
    const panel = document.getElementById("asset-library-panel");
    if (!panel) return;
    const groups = assetLibraryByProduct();
    if (!groups.length) {
      panel.innerHTML = emptyBlock(`<b>素材库为空。</b>导入广告 creative data 后，命中优质标准（有单 且 ROI≥阈值）的素材自动入库，按商品ID分表，建手动计划时一键复制 Video ID。`);
      return;
    }
    const sections = [];
    for (const [productId, assets] of groups) {
      const active = assets.filter((a) => a.status === "活跃");
      const decayed = assets.filter((a) => a.status === "衰退");
      const rowsOf = (list) => list.map((a) => `<tr>
        <td style="font-family:monospace;font-size:11px;">${escapeHtml(a.videoId)}</td>
        <td>${escapeHtml(a.account || "—")}</td>
        <td style="font-size:12px;">${escapeHtml(a.timePosted || "—")}</td>
        <td><span class="tag ${a.tier === "已验证" ? "tag-green" : "tag-blue"}">${a.tier}</span></td>
        <td style="font-size:12px;">${a.cumOrders}单 · ${fmtUsd(a.cumRevenue)} · ROI ${a.roi === Infinity ? "∞" : a.roi.toFixed(1)}</td>
        <td style="font-size:12px;color:#94a3b8;">${a.firstDate} 入库 · 活跃至 ${a.lastActiveDate || "—"}</td>
        <td><button class="ops-chip asset-remove" data-vid="${escapeHtml(a.videoId)}" style="font-size:11px;">移除</button></td>
      </tr>`).join("");
      sections.push(`<div class="card" style="margin-bottom:12px;border-left:4px solid #f59e0b;">
        <div class="card-title" style="font-size:14px;">商品 <span style="font-family:monospace;">${escapeHtml(productId)}</span> <span>活跃 ${active.length} 条${decayed.length ? ` · 衰退 ${decayed.length} 条（折叠置底）` : ""}</span>
          <button class="btn btn-primary asset-copy" data-pid="${escapeHtml(productId)}" style="margin-left:auto;font-size:12px;padding:6px 12px;">📋 一键复制活跃素材ID（${active.length}）</button>
        </div>
        <div class="desktop-table-wrap"><table class="desktop-table">
          <thead><tr><th>Video ID</th><th>达人账号</th><th>发布时间</th><th>分层</th><th>累计表现</th><th>入库/活跃</th><th></th></tr></thead>
          <tbody>${rowsOf(active)}${decayed.length ? rowsOf(decayed) : ""}</tbody>
        </table></div>
      </div>`);
    }
    panel.innerHTML = sections.join("") + `<div style="font-size:12px;color:#64748b;">素材库以 Video ID 为键跨天累积，自动入库/自动标衰退（${getThresholds().assetDecayDays} 天无消耗无出单），只标不删。复制结果已按 GMVMax 手动选素材格式排版（换行分隔），直接粘贴。视频文件（mp4）上传到「数据接入」素材通道后，文件名含 Video ID 的自动关联。</div>`;
    panel.querySelectorAll(".asset-copy").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pid = btn.getAttribute("data-pid");
        const group = groups.find(([g]) => g === pid);
        const ids = group ? group[1].filter((a) => a.status === "活跃").map((a) => a.videoId) : [];
        const text = ids.join("\n");
        const done = () => { btn.textContent = `✅ 已复制 ${ids.length} 个`; setTimeout(() => { renderAssetLibraryV33(); }, 1200); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt("手动复制：", text));
        else window.prompt("手动复制：", text);
      });
    });
    panel.querySelectorAll(".asset-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const vid = btn.getAttribute("data-vid");
        if (!window.confirm(`把素材 ${vid} 移出素材库？\n（数据仍保留，只是不再展示；清除全部数据时会一并重置）`)) return;
        meta.removedAssets = [...new Set([...(meta.removedAssets || []), vid])];
        await saveV33();
        renderAssetLibraryV33();
      });
    });
  }

  // 阈值设置（prompt 轻量实现）
  function openThresholdSettings() {
    const T = getThresholds();
    const input = window.prompt(
      `当前阈值（逗号分隔修改，留空保持不变）：\n\n` +
      `优质素材 ROI ≥ ${T.qualityRoi}\n消耗分界 ≥ ${T.qualityMinSpend}\n新计划观察期 ${T.observeDays} 天\n观察期最低消耗 ${T.observeMinSpend}\n默认目标 ROI ${T.defaultTargetRoi}\n连降预警 ${T.warnStreak} 天\n连降关停 ${T.killStreak} 天\n素材衰退 ${T.assetDecayDays} 天\n\n输入格式示例：qualityRoi=5, killStreak=4`, "");
    if (!input) return;
    const patch = {};
    input.split(/[,，;；]/).forEach((pair) => {
      const m = pair.match(/(\w+)\s*=\s*([\d.]+)/);
      if (m && Object.prototype.hasOwnProperty.call(DEFAULT_THRESHOLDS, m[1])) patch[m[1]] = Number(m[2]);
    });
    if (Object.keys(patch).length) {
      saveThresholds(patch);
      window.alert("✅ 阈值已更新，看板已按新规则重算。");
      renderAllV33();
    }
  }

  /* ================= 渲染：达人 BD 页 ================= */
  function renderBdPageV33() {
    const kpiEl = document.getElementById("bd-kpi-row");
    const listsEl = document.getElementById("bd-lists-panel");
    const trendEl = document.getElementById("bd-trend-panel");
    const ledgerEl = document.getElementById("bd-ledger-panel");
    const ordersEl = document.getElementById("bd-orders-panel");
    if (!kpiEl && !listsEl) return;
    const creatorRows = scopedRows("creatorDaily");
    if (!creatorRows.length) {
      const guide = emptyBlock(`<b>达人订单待导入。</b>到「数据接入」页上传店铺导出的「达人订单」日报（一达人一行）。导入后这里出现：每日三清单（新增/流失/连续动销）、动销趋势、定向转化、高曝光0产出。`);
      if (kpiEl) kpiEl.innerHTML = "";
      if (listsEl) listsEl.innerHTML = guide;
      if (trendEl) trendEl.innerHTML = "";
    } else {
      const k = creatorKpis();
      const lists = creatorThreeLists();
      if (kpiEl && k) {
        kpiEl.innerHTML =
          kpiCard("动销达人", `${k.activeCount} 位`, `${k.latest} · 在档 ${k.total}`, "#059669") +
          kpiCard("达人 GMV", fmtThb(k.gmv), `佣金 ${fmtThb(k.commission)}（${k.commissionRate != null ? (k.commissionRate * 100).toFixed(1) + "%" : "—"}）`, "") +
          kpiCard("定向合作占比", k.directedRatio != null ? `${(k.directedRatio * 100).toFixed(0)}%` : "待导入", "定向 GMV ÷ 总 GMV（BD绑定深度）", "#2563eb") +
          kpiCard(`Top${getThresholds().topN} 集中度`, `${(k.concentration * 100).toFixed(0)}%`, k.concentration >= getThresholds().concentration ? `⚠️ ${k.topNames.slice(0, 2).join("、")} 占比过高` : "分布健康", k.concentration >= getThresholds().concentration ? "#dc2626" : "#059669");
      }
      if (listsEl && lists) {
        const mkList = (title, cls, rows, line, empty) => `<div class="real-ranking-card ${cls}">
          <div class="real-ranking-title">${title}</div>
          <div class="real-ranking-subtitle">${rows.length ? `共 ${rows.length} 位 · ${lists.prev ? `对比 ${lists.prev}` : "首个数据日"}` : ""}</div>
          ${rows.length ? `<div class="lb-list">${rows.slice(0, 10).map((r, i) => `<div class="lb-row">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-name">${escapeHtml(r.creator)}</span>
            <span class="lb-value">${line(r)}</span>
          </div>`).join("")}</div>` : emptyBlock(empty)}
        </div>`;
        listsEl.innerHTML = `<div class="real-ranking-grid" style="grid-template-columns:repeat(3,1fr);">
          ${mkList("🌱 新增动销（当天建联锁定向）", "gmv", lists.fresh, (r) => fmtThb(r.gmv), "今日无新增动销达人。")}
          ${mkList("💎 连续动销（基本盘维护）", "", lists.steady, (r) => fmtThb(r.gmv), "今日无连续动销达人。")}
          ${mkList("🍂 流失预警（查原因/唤醒）", "up", lists.lost, (r) => `上期 ${fmtThb(r.lastGmv)}`, "今日无流失达人。👍")}
        </div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">口径：「动销」= 当日联盟 GMV&gt;0。新增 = 历史从未动销或沉默后复出；流失 = 上期动销但今天不在名单（达人订单只含当天有数据的达人）。</div>`;
      }
      if (trendEl) {
        const k2 = creatorKpis();
        trendEl.innerHTML = `<div class="trend-grid">
          <div class="mini-chart-card"><div class="mini-chart-title"><span>📈 动销达人数（BD 北极星）</span><span>${k2 ? k2.activeCount : "—"} 位</span></div>${sparkChart(creatorActiveTrend(), "#0ea5e9")}</div>
          <div class="mini-chart-card"><div class="mini-chart-title"><span>💡 高曝光 0 产出（换品邀请对象）</span><span>${k2 ? k2.zeroOut.length : 0} 位</span></div>
            ${k2 && k2.zeroOut.length ? `<div class="lb-list" style="max-height:110px;overflow:auto;">${k2.zeroOut.map((r) => `<div class="lb-row"><span class="lb-name">${escapeHtml(r.creator)}</span><span class="lb-value">曝光 ${formatCompact(r.exposure)} · 0 单</span></div>`).join("")}</div>` : `<div style="font-size:12px;color:#94a3b8;padding:14px 0;text-align:center;">今日无高曝光 0 产出达人</div>`}
          </div>
        </div>`;
      }
    }
    // SKU 寄样台账
    if (ledgerEl) {
      if (!scopedRows("samples").length) {
        ledgerEl.innerHTML = emptyBlock(`样品订单待导入。上传店铺「样品订单」导出后，这里按 Seller SKU 展示 当日寄样数 / 累计寄样数 / 最近寄样日期。`);
      } else {
        const L = sampleLedger();
        ledgerEl.innerHTML = `<div class="desktop-table-wrap"><table class="desktop-table">
          <thead><tr><th>Seller SKU</th><th>品名</th><th>当日寄样</th><th>累计寄样</th><th>最近寄样</th></tr></thead>
          <tbody>${L.rows.map((r) => `<tr>
            <td><strong>${escapeHtml(r.sellerSku)}</strong></td>
            <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.productName || "")}">${escapeHtml(r.productName || "—")}</td>
            <td>${L.latest ? (r.byDate.get(L.latest) || 0) : 0}</td>
            <td style="font-weight:700;">${r.total}</td>
            <td>${r.lastDate || "—"}</td>
          </tr>`).join("")}</tbody></table></div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">最近数据日 ${L.latest || "—"} · 当日全店寄样 ${L.todayTotal} 件 · 累计 ${L.rows.reduce((s, r) => s + r.total, 0)} 件。样品导出不含达人信息，台账按 SKU 维度管理。</div>`;
      }
    }
    // 联盟订单明细（最新日）
    if (ordersEl) {
      if (!scopedRows("affOrders").length) {
        ordersEl.innerHTML = emptyBlock(`联盟订单待导入。上传后这里展示最新日订单流水（达人×商品×内容×佣金），用于下钻核对。`);
      } else {
        const latest = datasetDates("affOrders").pop();
        const rows = rowsOnDate("affOrders", latest);
        const commission = rows.reduce((s, r) => s + (r.commission || 0), 0);
        ordersEl.innerHTML = `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">${latest} · ${rows.length} 笔 · 预估佣金合计 ${fmtThb(commission)}</div>
        <div class="desktop-table-wrap" style="max-height:360px;overflow:auto;"><table class="desktop-table">
          <thead><tr><th>达人</th><th>商品ID</th><th>内容</th><th>件数</th><th>支付金额</th><th>佣金</th><th>状态</th></tr></thead>
          <tbody>${rows.slice(0, 100).map((r) => `<tr>
            <td>${escapeHtml(r.creator || "—")}</td>
            <td style="font-family:monospace;font-size:11px;">${escapeHtml(r.productId || "—")}</td>
            <td style="font-size:12px;">${escapeHtml(r.contentType || "—")}</td>
            <td>${r.qty ?? "—"}</td>
            <td>${fmtThb(r.amount)}</td>
            <td>${fmtThb(r.commission)}</td>
            <td style="font-size:12px;">${escapeHtml(r.status || "—")}</td>
          </tr>`).join("")}</tbody></table></div>
        ${rows.length > 100 ? `<div style="font-size:12px;color:#94a3b8;margin-top:6px;">仅展示前 100 笔，共 ${rows.length} 笔。</div>` : ""}`;
      }
    }
  }

  /* ================= 渲染：短视频页 ================= */
  function renderVideosPageV33() {
    const kpiEl = document.getElementById("videos-kpi-row");
    const boardEl = document.getElementById("video-gmv-board");
    const gapEl = document.getElementById("video-ads-gap-panel");
    const selfEl = document.getElementById("self-video-panel");
    if (!kpiEl && !boardEl) return;
    const boards = videoBoards();
    if (!boards) {
      if (kpiEl) kpiEl.innerHTML = "";
      if (boardEl) boardEl.innerHTML = emptyBlock(`<b>联盟视频订单待导入。</b>到「数据接入」页上传「全部视频订单」导出。出单视频榜、GPM 榜、「出单但未投广告」联动清单都从这里生成。`);
      if (gapEl) gapEl.innerHTML = "";
    } else {
      if (kpiEl) {
        kpiEl.innerHTML =
          kpiCard("在档视频", `${boards.total} 条`, boards.latest, "") +
          kpiCard("出单视频", `${boards.sellingCount} 条`, `出单率 ${boards.total ? (boards.sellingCount / boards.total * 100).toFixed(1) : 0}%`, "#059669") +
          kpiCard("视频 GMV", fmtThb(boards.gmv), "联盟视频归因口径", "");
      }
      if (boardEl) {
        const mkBoard = (title, subtitle, rows, metric) => `<div class="real-ranking-card gmv">
          <div class="real-ranking-title">${title}</div>
          <div class="real-ranking-subtitle">${subtitle}</div>
          ${rows.length ? `<div class="lb-list">${rows.map((r, i) => `<div class="lb-row" title="${escapeHtml(r.title || "")}">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-name" style="font-family:monospace;font-size:11px;">${escapeHtml(r.videoId)}</span>
            <span class="lb-sub">${escapeHtml(r.creator || "—")} · 商品 ${escapeHtml(r.productId || "—")}</span>
            <span class="lb-value">${metric(r)}</span>
          </div>`).join("")}</div>` : emptyBlock("当日无出单视频。")}
        </div>`;
        boardEl.innerHTML = `<div class="real-ranking-grid" style="grid-template-columns:1fr 1fr;">
          ${mkBoard("🏆 出单视频榜（GMV）", `${boards.latest} · 按归因GMV降序`, boards.byGmv, (r) => fmtThb(r.gmv))}
          ${mkBoard("⚡ GPM 榜（选素材放大）", "千次曝光成交金额降序", boards.byGpm, (r) => r.gmv != null && r.exposure ? `฿${formatNumber(r.gmv / r.exposure * 1000, 0)}/千曝` : (r.gpm != null ? `฿${formatNumber(r.gpm, 0)}` : "—"))}
        </div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">完播率/互动率仅作参考列，不做内容诊断（达人素材内容不可干预，这里用于「选」不用于「改」）。</div>`;
      }
      if (gapEl) {
        if (!scopedRows("adCreatives").length) {
          gapEl.innerHTML = emptyBlock("广告数据未导入，暂时无法判断哪些出单视频还没被广告利用。导入 creative data 后自动生成联动清单。");
        } else {
          const gap = videosNotInAds();
          gapEl.innerHTML = gap.length
            ? `<div class="priority-item sev-good"><div class="priority-item-title">🚀 ${gap.length} 条出单视频还没被广告利用 —— 拿去投 GMVMax</div>
              <div class="priority-item-body">${gap.slice(0, 8).map((r) => `达人 ${escapeHtml(r.creator || "?")} 的 <span style="font-family:monospace;">${escapeHtml(r.videoId)}</span>（${r.orders}单 / ${fmtThb(r.gmv)}）`).join("<br>")}${gap.length > 8 ? `<br>…共 ${gap.length} 条` : ""}<br>动作：确认授权后拉进广告计划投放，让已被自然流量验证的素材跑付费量。</div></div>`
            : emptyBlock("所有出单视频都已在广告投放中。👍");
        }
      }
    }
    // 自营账号
    if (selfEl) {
      if (!scopedRows("selfVideos").length) {
        selfEl.innerHTML = emptyBlock(`<b>自营账号前台数据待导入。</b>上传自营账号数据（账号/视频ID/商品ID/播放量）后，系统自动从「全部视频订单」拼接归因 GMV；无归因成交的显示 0（真实零，不是缺数据）。`);
      } else {
        const { rows, accounts } = selfVideoRows();
        const byAccount = new Map();
        rows.forEach((r) => {
          const a = byAccount.get(r.account || "未命名") || { account: r.account || "未命名", videos: 0, views: 0, gmv: 0, orders: 0, matched: 0 };
          a.videos += 1; a.views += r.views || 0;
          if (r.matched) { a.gmv += r.gmv || 0; a.orders += r.orders || 0; a.matched += 1; }
          byAccount.set(a.account, a);
        });
        selfEl.innerHTML = `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">自营账号：${accounts.map(escapeHtml).join("、") || "—"} · 共 ${rows.length} 条视频记录</div>
        <div class="desktop-table-wrap"><table class="desktop-table">
          <thead><tr><th>账号</th><th>视频数</th><th>播放量</th><th>归因GMV</th><th>订单</th><th>口径</th></tr></thead>
          <tbody>${[...byAccount.values()].map((a) => `<tr>
            <td><strong>${escapeHtml(a.account)}</strong></td><td>${a.videos}</td><td>${formatCompact(a.views)}</td>
            <td style="font-weight:600;">${fmtThb(a.gmv)}</td><td>${a.orders}</td>
            <td style="font-size:12px;color:#94a3b8;">${a.matched}/${a.videos} 条有归因</td>
          </tr>`).join("")}</tbody></table></div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">GMV 从「全部视频订单」按 Video ID 拼接；挂联盟商品的自营视频才有归因数据。</div>`;
      }
    }
  }

  /* ================= 渲染：预警页（四象限 + 交叉诊断） ================= */
  function renderAlertExtrasV33() {
    const quadEl = document.getElementById("product-quadrant-panel");
    if (quadEl) {
      const q = productQuadrants();
      if (!q) {
        quadEl.innerHTML = emptyBlock("商品快照不足（需 product_list 至少 1 天、且含曝光/点击/订单字段），或商品数 &lt; 4，暂无法画四象限。");
      } else {
        const mkQ = (title, advice, rows, color) => `<div class="real-ranking-card" style="border-top-color:${color};">
          <div class="real-ranking-title">${title}（${rows.length}）</div>
          <div class="real-ranking-subtitle">${advice}</div>
          ${rows.length ? `<div class="lb-list" style="max-height:180px;overflow:auto;">${rows.slice(0, 8).map((p) => `<div class="lb-row" style="cursor:pointer;" data-diag-id="${escapeHtml(p.id)}">
            <span class="lb-name" style="font-size:12px;" title="${escapeHtml(p.name || "")}">${escapeHtml((p.name || p.id).slice(0, 18))}</span>
            <span class="lb-sub">曝光 ${formatCompact(p.exposure)} · CVR ${(p.cvr * 100).toFixed(1)}%${p.sellers != null ? ` · ${p.sellers}达人` : ""}</span>
            <span class="lb-value">${fmtThb(p.gmv)}</span>
          </div>`).join("")}</div>` : emptyBlock("无")}
        </div>`;
        quadEl.innerHTML = `<div style="font-size:12px;color:#64748b;margin-bottom:10px;">以曝光中位数（${formatCompact(q.medExposure)}）× 转化中位数（${(q.medCvr * 100).toFixed(2)}%）分象限，点击商品出交叉诊断。</div>
        <div class="real-ranking-grid" style="grid-template-columns:repeat(2,1fr);">
          ${mkQ("🚀 高曝高转 · 加码", "加大流量投入，守住转化", q.quad.star, "#059669")}
          ${mkQ("🔧 高曝低转 · 优化承接", "流量够但不成交：查价格/详情页/评价", q.quad.convert, "#d97706")}
          ${mkQ("📣 低曝高转 · 加流量", "转化好但没人看：投广告 + 找达人拓量", q.quad.traffic, "#2563eb")}
          ${mkQ("🧊 双低 · 收缩清货", "不投流，商品卡清库存", q.quad.drop, "#94a3b8")}
        </div>
        ${q.hasOrders && q.concentrated.length ? `<div class="priority-item sev-medium" style="margin-top:12px;"><div class="priority-item-title">⚠️ 集中度预警：${q.concentrated.length} 个头部商品动销达人 ≤2 位</div><div class="priority-item-body">${q.concentrated.slice(0, 5).map((p) => `${escapeHtml((p.name || p.id).slice(0, 16))}（${p.sellers}位达人 / ${fmtThb(p.gmv)}）`).join("、")}。达人一旦停带 GMV 即断，动作：为这些品拓达人。</div></div>` : ""}
        ${!q.hasOrders ? `<div style="font-size:12px;color:#94a3b8;margin-top:8px;">导入联盟订单后追加「每品动销达人数」集中度预警。</div>` : ""}`;
        quadEl.querySelectorAll("[data-diag-id]").forEach((row) => {
          row.addEventListener("click", () => renderCrossDiagnosis(row.getAttribute("data-diag-id")));
        });
      }
    }
  }
  // 交叉诊断卡（预警页，趋势面板下方）
  function renderCrossDiagnosis(productId) {
    const panel = document.getElementById("cross-diagnosis-panel");
    if (!panel) return;
    const ev = crossDiagnose(productId);
    panel.innerHTML = `<div class="card" style="border-left:4px solid #8b5cf6;margin-top:12px;">
      <div class="card-title">🔗 交叉诊断 · 商品 ${escapeHtml(productId)} <span>全模块自动取证 · 相关性≠因果</span></div>
      <div class="lb-list">${ev.map((e) => `<div class="lb-row">
        <span class="tag ${e.ok ? "tag-green" : "tag-gray"}" style="min-width:44px;text-align:center;">${e.module}</span>
        <span class="lb-sub" style="flex:1;">${escapeHtml(e.text)}</span>
      </div>`).join("")}</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px;">以上是各模块证据陈列，帮你收敛排查范围；结论需人工确认，系统不把相关性当因果。</div>
    </div>`;
    panel.style.display = "";
  }

  /* ================= 商品趋势面板保留（复用旧逻辑轻量版） ================= */
  function renderTrendSearchV33(keyword) {
    const panel = document.getElementById("product-trend-panel");
    if (!panel) return;
    const query = String(keyword || "").trim();
    if (!query) { panel.style.display = "none"; return; }
    const data = bridge.getData();
    if (!data || !Array.isArray(data.stores)) return;
    const matches = [];
    const seen = new Set();
    data.stores.forEach((store) => {
      (store.snapshots || []).forEach((snap) => {
        (snap.products || []).forEach((p) => {
          if (!p.id || seen.has(p.id)) return;
          if (p.id === query || (query.length >= 4 && p.id.includes(query))) {
            seen.add(p.id);
            matches.push({ id: p.id, name: p.name, store: store.name });
          }
        });
      });
    });
    if (!matches.length) { panel.style.display = "none"; return; }
    if (matches.length > 1) {
      panel.innerHTML = `<div class="card" style="border-left:4px solid #38bdf8;">
        <div class="card-title">🔍 找到 ${matches.length} 个匹配商品 <span>点击查看趋势 + 交叉诊断</span></div>
        <div class="lb-list">${matches.slice(0, 8).map((item) => `<div class="lb-row" style="cursor:pointer;" data-trend-id="${escapeHtml(item.id)}">
          <span class="lb-name">${escapeHtml(item.name)}</span>
          <span class="lb-sub">${escapeHtml(item.store)} · ${escapeHtml(item.id)}</span>
        </div>`).join("")}</div></div>`;
      panel.style.display = "";
      panel.querySelectorAll("[data-trend-id]").forEach((row) => row.addEventListener("click", () => renderProductTrendV33(row.getAttribute("data-trend-id"))));
      return;
    }
    renderProductTrendV33(matches[0].id);
  }
  function renderProductTrendV33(productId) {
    const panel = document.getElementById("product-trend-panel");
    if (!panel) return;
    const t = collectProductTrendSafe(productId);
    if (!t || !t.points.length) { panel.style.display = "none"; return; }
    const points = t.points;
    const metric = (get, fmt) => points.map((p) => ({ date: p.date, value: get(p), text: get(p) == null ? "待导入" : fmt(get(p)) }));
    const latest = points[points.length - 1];
    panel.innerHTML = `<div class="card" style="border-left:4px solid #38bdf8;">
      <div class="card-title">📈 商品近7天趋势 <span>商品 ID ${escapeHtml(productId)}</span></div>
      <div class="trend-grid">
        <div class="mini-chart-card"><div class="mini-chart-title"><span>💰 GMV</span><span>${fmtThb(latest.gmv)}</span></div>${sparkChart(metric((p) => p.gmv, fmtThb), "#0ea5e9")}</div>
        <div class="mini-chart-card"><div class="mini-chart-title"><span>👁 曝光</span><span>${formatCompact(latest.exposure)}</span></div>${sparkChart(metric((p) => p.exposure, formatCompact), "#8b5cf6")}</div>
        <div class="mini-chart-card"><div class="mini-chart-title"><span>👆 CTR</span><span>${latest.exposure ? (latest.clicks / latest.exposure * 100).toFixed(2) + "%" : "—"}</span></div>${sparkChart(metric((p) => p.exposure ? p.clicks / p.exposure * 100 : null, (v) => v.toFixed(2) + "%"), "#f59e0b")}</div>
        <div class="mini-chart-card"><div class="mini-chart-title"><span>🛒 CVR</span><span>${latest.clicks ? (latest.orders / latest.clicks * 100).toFixed(2) + "%" : "—"}</span></div>${sparkChart(metric((p) => p.clicks ? p.orders / p.clicks * 100 : null, (v) => v.toFixed(2) + "%"), "#10b981")}</div>
      </div>
      <div style="margin-top:6px;"><button class="ops-chip" id="trend-diag-btn">🔗 对该商品做交叉诊断</button></div>
    </div>`;
    panel.style.display = "";
    const btn = panel.querySelector("#trend-diag-btn");
    if (btn) btn.addEventListener("click", () => renderCrossDiagnosis(productId));
  }

  /* ================= 经营总览「今日优先处理」来源 ================= */
  function creatorPriorityProviderV33() {
    if (!scopedRows("creatorDaily").length) {
      return { items: [], emptyHtml: `<b>达人订单未导入。</b>到「数据接入」页上传达人订单日报后，这里自动列出：新增动销（建联）、流失预警（唤醒）、高曝光0产出（换品邀请）。` };
    }
    const lists = creatorThreeLists();
    const items = [];
    if (lists) {
      lists.fresh.slice(0, 3).forEach((r) => items.push({
        sev: "good",
        title: `🌱 新增动销 · ${r.creator}（${fmtThb(r.gmv)}）`,
        body: `【数据】${lists.latest} 首次/复出动销，GMV ${fmtThb(r.gmv)}。<br>【建议动作】当天建联，趁蜜月期锁定向合作（定向占比越高，货源越稳）。`,
        tags: ["建联", "达人"],
      }));
      lists.lost.slice(0, 3).forEach((r) => items.push({
        sev: "medium",
        title: `🍂 流失预警 · ${r.creator}`,
        body: `【数据】上期（${r.lastDate}）动销 ${fmtThb(r.lastGmv)}，今日不在名单。<br>【建议动作】排查原因：品断了 / 佣金无竞争力 / 被竞对挖走；值得留的当天唤醒。`,
        tags: ["唤醒", "达人"],
      }));
    }
    return { items: items.slice(0, 6), emptyHtml: "今日达人盘无新增流失波动。👍" };
  }
  function adsPriorityProviderV33() {
    if (!scopedRows("adCreatives").length) {
      return { items: [], emptyHtml: `<b>广告数据未导入。</b>到「数据接入」页上传 creative data 后，这里自动列出：死刑计划关停、连降预警、烧钱素材暂停、待放量素材加测。` };
    }
    const steps = adsActionSequence();
    const items = steps.slice(0, 5).map((s) => ({
      sev: s.phase === 1 ? "high" : s.phase === 2 ? "medium" : "good",
      title: `${s.icon} ${s.title}`,
      body: escapeHtml(s.detail),
      tags: [s.phaseName],
    }));
    return { items, emptyHtml: "今日广告盘无必须动作。👍" };
  }
  function videoPriorityProviderV33() {
    if (!scopedRows("affVideos").length) {
      return { items: [], emptyHtml: `<b>视频订单未导入。</b>到「数据接入」页上传「全部视频订单」后，这里自动列出：出单但未投广告的视频（拿去投 GMVMax）。` };
    }
    const gap = videosNotInAds();
    const items = gap.slice(0, 5).map((r) => ({
      sev: "good",
      title: `🚀 出单视频未投广告 · ${r.creator || "?"} 的 ${r.videoId}`,
      body: `【数据】${r.orders} 单 / ${fmtThb(r.gmv)}（自然流量验证过）。<br>【建议动作】确认授权 → 拉进 GMVMax 计划放大。`,
      tags: ["广告联动"],
    }));
    return { items, emptyHtml: "出单视频均已被广告利用。👍" };
  }
  /* ================= 价格利润引擎（v3.4 · 成交价扫码 + 亏损预警） =================
   * 数据流：价格利润核算表（定价/费率/运费阶梯，整表覆盖）+ 每日订单明细（OrderSKUList，按 订单|SKU 去重合并）
   * 判定链：实际成交价 → 平台费（费率表 + 运费阶梯按订单总重计一次）→ 广告分摊 → 商品成本 → 人员成本 → 净利润
   * 未匹配 SKU 不编造：列入清单按成交额排序，手动补一次成本永久记住（localStorage）
   * ================================================================== */
  const V33_PRICING_KEY = "ops-v33-pricing";
  const COST_PATCH_KEY = "tiktok-v33-cost-patches";
  const PROFIT_SETTINGS_KEY = "tiktok-v33-profit-settings";
  let pricing = null;          // { importedAt, fileName, flags, rates, tiers, skus }
  let pricingIndex = null;     // 懒构建 { exact:Map, base:Map }

  const DEFAULT_PROFIT_SETTINGS = { adsShare: 0.10, affMode: "auto", includeStaff: true };
  function getProfitSettings() {
    try {
      return Object.assign({}, DEFAULT_PROFIT_SETTINGS, JSON.parse(window.localStorage.getItem(PROFIT_SETTINGS_KEY) || "{}"));
    } catch (e) { return Object.assign({}, DEFAULT_PROFIT_SETTINGS); }
  }
  function saveProfitSettings(patch) {
    const next = Object.assign(getProfitSettings(), patch);
    try { window.localStorage.setItem(PROFIT_SETTINGS_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }
  function getCostPatches() {
    try { return JSON.parse(window.localStorage.getItem(COST_PATCH_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function setCostPatch(sellerSku, cost, weightKg) {
    const key = cleanText(sellerSku).toLowerCase();
    if (!key) return;
    const patches = getCostPatches();
    patches[key] = { cost, weightKg: weightKg ?? null, at: new Date().toISOString() };
    try { window.localStorage.setItem(COST_PATCH_KEY, JSON.stringify(patches)); } catch (e) {}
  }

  // —— 价格利润核算表解析（产品定价利润明细 / 费率参数表 / 运费阶梯表）——
  async function parsePricing(file) {
    const sheets = await readWorkbook(file);
    const findSheet = (kws) => sheets.find((s) => kws.some((k) => s.sheetName.includes(k)));
    const skuSheet = findSheet(["定价利润", "产品定价"]) || sheets[0];
    // 全局设置：前几行里 秒杀活动/直播活动/联盟广告 右侧的 是/否
    const flags = { miaosha: false, live: false, affAd: true };
    (skuSheet.rows || []).slice(0, 4).forEach((row) => {
      (row || []).forEach((cell, ci) => {
        const t = cleanText(cell);
        [["秒杀", "miaosha"], ["直播", "live"], ["联盟广告", "affAd"]].forEach(([kw, key]) => {
          if (!t.includes(kw)) return;
          for (let j = ci + 1; j <= Math.min(ci + 2, (row || []).length - 1); j++) {
            const v = cleanText(row[j]);
            if (v === "是" || v === "否") { flags[key] = v === "是"; break; }
          }
        });
      });
    });
    // SKU 明细
    const hi = locateHeaderRow(skuSheet.rows, ["SKU", "成本价", "活动价"]);
    if (hi < 0) throw new Error(`${file.name}：未找到 SKU / 成本价 / 活动价 表头`);
    const headers = (skuSheet.rows[hi] || []).map((c) => String(c ?? "").trim());
    const col = {
      sku: HEAD(headers, ["SKU"]),
      weight: HEAD(headers, ["重量(kg)", "重量"]),
      cost: HEAD(headers, ["成本价(฿)", "成本价", "成本"]),
      price: HEAD(headers, ["活动价(฿)", "活动价", "售价"]),
    };
    if (col.sku < 0 || col.cost < 0) throw new Error(`${file.name}：SKU 或 成本价 列未识别`);
    const skus = [];
    for (let i = hi + 1; i < skuSheet.rows.length; i++) {
      const r = skuSheet.rows[i] || [];
      const sku = cleanText(r[col.sku]);
      if (!sku || /^sku$/i.test(sku)) continue;
      skus.push({
        sku,
        base: sku.split(/\s+/)[0],
        weightKg: col.weight >= 0 ? cleanNum(r[col.weight]) : null,
        cost: cleanNum(r[col.cost]),
        activityPrice: col.price >= 0 ? cleanNum(r[col.price]) : null,
      });
    }
    if (!skus.length) throw new Error(`${file.name}：定价明细为空`);
    // 费率参数表（读不到就保留内置默认值，与店铺核算表一致）
    const rates = { transaction: 0.0321, shopCommission: 0.107, affCommission: 0.10, affAdCommission: 0.03, miaosha: 0.0321, live: 0.0321, growth: 0.0803, infra: 0.0015, staff: 0.06 };
    const rateSheet = findSheet(["费率参数"]);
    if (rateSheet) {
      const rateMap = [
        ["交易手续费", "transaction"], ["Shop 佣金", "shopCommission"], ["Shop佣金", "shopCommission"],
        ["联盟店铺广告佣金", "affAdCommission"], ["联盟广告佣金", "affAdCommission"], ["联盟佣金", "affCommission"],
        ["秒杀", "miaosha"], ["直播", "live"], ["电商增长", "growth"], ["基础设施", "infra"],
        ["人员", "staff"], ["综合成本", "staff"],
      ];
      rateSheet.rows.forEach((row) => {
        const name = cleanText(row && row[0]);
        const raw = row && row[1];
        let val = cleanNum(raw);
        if (!name || val == null) return;
        // 单元格是百分比格式时读到的是 "3.21%" → 3.21，需要除回 100
        if (String(raw ?? "").includes("%") || val > 1) val = val / 100;
        for (const [kw, key] of rateMap) {
          if (name.includes(kw)) { rates[key] = val; break; }
        }
      });
    }
    // 运费阶梯表
    const tiers = [];
    const tierSheet = findSheet(["运费阶梯"]);
    if (tierSheet) {
      const thi = locateHeaderRow(tierSheet.rows, ["重量下限", "商家净运费"]);
      if (thi >= 0) {
        const th = (tierSheet.rows[thi] || []).map((c) => String(c ?? "").trim());
        const tc = {
          lo: HEAD(th, ["重量下限", "下限"]),
          hi: HEAD(th, ["重量上限", "上限"]),
          net: HEAD(th, ["商家净运费", "净运费"]),
        };
        for (let i = thi + 1; i < tierSheet.rows.length; i++) {
          const r = tierSheet.rows[i] || [];
          const lo = tc.lo >= 0 ? cleanNum(r[tc.lo]) : null;
          const hiV = tc.hi >= 0 ? cleanNum(r[tc.hi]) : null;
          if (lo == null && hiV == null) continue;
          tiers.push({ lo: lo || 0, hi: hiV == null ? Infinity : hiV, net: tc.net >= 0 ? (cleanNum(r[tc.net]) || 0) : 0 });
        }
      }
    }
    if (!tiers.length) tiers.push({ lo: 0, hi: Infinity, net: 0 });
    const withCost = skus.filter((s) => s.cost != null).length;
    return {
      pricing: { importedAt: new Date().toISOString(), fileName: file.name, flags, rates, tiers, skus },
      note: `${skus.length} 个 SKU（${withCost} 个有成本）· ${tiers.length} 档运费 · 联盟广告${flags.affAd ? "开" : "关"}`,
    };
  }

  // —— 订单明细解析（OrderSKUList：第 1 行英文表头，第 2 行说明自动跳过）——
  async function parseOrderLines(file) {
    const sheets = await readWorkbook(file);
    const out = [];
    for (const { rows } of sheets) {
      const hi = locateHeaderRow(rows, ["Order ID", "Seller SKU", "SKU Subtotal After Discount"]);
      if (hi < 0) continue;
      const headers = (rows[hi] || []).map((c) => String(c ?? "").trim());
      const col = {
        orderId: HEAD(headers, ["Order ID", "订单号", "订单ID"]),
        status: HEAD(headers, ["Order Status", "订单状态"]),
        skuId: HEAD(headers, ["SKU ID", "SKUID"]),
        sellerSku: HEAD(headers, ["Seller SKU", "商家SKU", "商家 SKU"]),
        productName: HEAD(headers, ["Product Name", "商品名称", "产品名称"]),
        qty: HEAD(headers, ["Quantity", "数量"]),
        returnQty: HEAD(headers, ["Sku Quantity of return", "退货数量", "退款数量"]),
        unitPrice: HEAD(headers, ["SKU Unit Original Price", "单价"]),
        dealPrice: HEAD(headers, ["SKU Subtotal After Discount", "折后小计", "成交价"]),
        orderAmount: HEAD(headers, ["Order Amount", "订单金额"]),
        refund: HEAD(headers, ["Order Refund Amount", "退款金额"]),
        created: HEAD(headers, ["Created Time", "创建时间", "下单时间"]),
        weight: HEAD(headers, ["Weight(kg)", "Weight", "重量"]),
        creator: HEAD(headers, ["Creator Handle", "达人账号", "达人"]),
      };
      if (col.orderId < 0 || col.dealPrice < 0) continue;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const orderId = cleanText(r[col.orderId]);
        if (!/^\d{6,}$/.test(orderId)) continue; // 跳过说明行/空行
        out.push({
          orderId,
          status: col.status >= 0 ? cleanText(r[col.status]) : "",
          skuId: col.skuId >= 0 ? cleanText(r[col.skuId]) : "",
          sellerSku: col.sellerSku >= 0 ? cleanText(r[col.sellerSku]) : "",
          productName: col.productName >= 0 ? cleanText(r[col.productName]) : "",
          qty: col.qty >= 0 ? (cleanNum(r[col.qty]) || 0) : 1,
          returnQty: col.returnQty >= 0 ? (cleanNum(r[col.returnQty]) || 0) : 0,
          unitPrice: col.unitPrice >= 0 ? cleanNum(r[col.unitPrice]) : null,
          dealPrice: cleanNum(r[col.dealPrice]),
          orderAmount: col.orderAmount >= 0 ? cleanNum(r[col.orderAmount]) : null,
          refund: col.refund >= 0 ? cleanNum(r[col.refund]) : null,
          date: col.created >= 0 ? (parseAnyDate(r[col.created], { order: "DMY" }) || dateFromFilename(file.name)) : dateFromFilename(file.name),
          weightKg: col.weight >= 0 ? cleanNum(r[col.weight]) : null,
          creator: col.creator >= 0 ? cleanText(r[col.creator]) : "",
        });
      }
    }
    if (!out.length) throw new Error(`${file.name}：未识别到订单明细行（需要 Order ID / Seller SKU / SKU Subtotal After Discount 列）`);
    return { records: out, note: `${out.length} 行明细 · ${new Set(out.map((r) => r.orderId)).size} 个订单` };
  }

  // —— 定价匹配：手动补成本 > 精确匹配 > 基础款（空格前段）——
  function buildPricingIndex() {
    pricingIndex = { exact: new Map(), base: new Map() };
    if (!pricing) return;
    pricing.skus.forEach((rec) => {
      const ek = rec.sku.toLowerCase();
      const prevE = pricingIndex.exact.get(ek);
      if (!prevE || (prevE.cost == null && rec.cost != null)) pricingIndex.exact.set(ek, rec);
      const bk = (rec.base || "").toLowerCase();
      if (!bk) return;
      const prevB = pricingIndex.base.get(bk);
      if (!prevB || (prevB.cost == null && rec.cost != null)) pricingIndex.base.set(bk, rec);
    });
  }
  function findPricing(sellerSku) {
    const s = cleanText(sellerSku);
    if (!s) return { rec: null, via: null };
    const patch = getCostPatches()[s.toLowerCase()];
    if (patch && patch.cost != null) {
      return { rec: { sku: s, base: s.split(/\s+/)[0], cost: patch.cost, weightKg: patch.weightKg, activityPrice: null, patched: true }, via: "patch" };
    }
    if (!pricing) return { rec: null, via: null };
    if (!pricingIndex) buildPricingIndex();
    const exact = pricingIndex.exact.get(s.toLowerCase());
    if (exact) return { rec: exact, via: "exact" };
    const baseRec = pricingIndex.base.get(s.split(/\s+/)[0].toLowerCase());
    if (baseRec) return { rec: baseRec, via: "base" };
    return { rec: null, via: null };
  }

  // —— 费率场景：固定费率 + 联盟模式 + 广告分摊 + 人员成本 ——
  function profitRates() {
    const s = getProfitSettings();
    const r = pricing ? pricing.rates : { transaction: 0.0321, shopCommission: 0.107, affCommission: 0.10, affAdCommission: 0.03, miaosha: 0.0321, live: 0.0321, growth: 0.0803, infra: 0.0015, staff: 0.06 };
    const flags = pricing ? pricing.flags : { miaosha: false, live: false, affAd: true };
    const affMode = s.affMode === "auto" ? (flags.affAd ? "ad" : "aff") : s.affMode;
    const affRate = affMode === "ad" ? r.affAdCommission : affMode === "aff" ? r.affCommission : 0;
    const fixed = r.transaction + r.shopCommission + r.growth + r.infra + (flags.miaosha ? r.miaosha : 0) + (flags.live ? r.live : 0);
    const staff = s.includeStaff ? r.staff : 0;
    return { fixed, affRate, affMode, staff, adsShare: s.adsShare, total: fixed + affRate + staff + s.adsShare, raw: r, flags };
  }
  function shipFeeNet(weightGrams) {
    if (!pricing || !pricing.tiers.length) return 0;
    const w = Math.max(0, weightGrams || 0);
    const tier = pricing.tiers.find((t) => w >= t.lo && w <= t.hi) || pricing.tiers[pricing.tiers.length - 1];
    return tier ? tier.net : 0;
  }

  // —— 成交价扫码：订单级聚合（运费按订单总重只计一次；取消单 / 全退行剔除）——
  function profitScan() {
    const R = profitRates();
    const lines = scopedRows("orders").filter((l) => l.status && !/取消|cancel/i.test(l.status) && (l.dealPrice || 0) > 0);
    const orderMap = new Map();
    const unmatched = new Map();
    let matchedLines = 0, totalLines = 0;
    lines.forEach((l) => {
      const effQty = Math.max(0, (l.qty || 0) - (l.returnQty || 0));
      if (effQty <= 0) return;
      totalLines++;
      const m = findPricing(l.sellerSku);
      const ratio = l.qty > 0 ? effQty / l.qty : 1;
      const revenue = (l.dealPrice || 0) * ratio;
      if (!orderMap.has(l.orderId)) orderMap.set(l.orderId, { orderId: l.orderId, date: l.date, creator: l.creator, revenue: 0, cost: 0, weightG: 0, items: [], hasUnmatched: false });
      const o = orderMap.get(l.orderId);
      o.revenue += revenue;
      o.weightG += (l.weightKg || 0) * 1000 * effQty;
      const matched = Boolean(m.rec && m.rec.cost != null);
      o.items.push({ sellerSku: l.sellerSku, productName: l.productName, qty: effQty, revenue, matched, rec: m.rec, via: m.via });
      if (matched) { o.cost += m.rec.cost * effQty; matchedLines++; }
      else {
        o.hasUnmatched = true;
        const key = l.sellerSku || "（空 SKU）";
        if (!unmatched.has(key)) unmatched.set(key, { sellerSku: key, productName: l.productName, lines: 0, qty: 0, revenue: 0 });
        const u = unmatched.get(key);
        u.lines++; u.qty += effQty; u.revenue += revenue;
      }
    });
    const orders = [...orderMap.values()].map((o) => {
      const ship = shipFeeNet(o.weightG);
      const platformFee = o.revenue * (R.fixed + R.affRate) + ship;
      const adsCost = o.revenue * R.adsShare;
      const staffCost = o.revenue * R.staff;
      const profit = o.revenue - platformFee - adsCost - o.cost - staffCost;
      return Object.assign(o, { ship, platformFee, adsCost, staffCost, profit, margin: o.revenue > 0 ? profit / o.revenue : null, complete: !o.hasUnmatched });
    });
    // SKU 价格体检聚合（全周期）
    const skuMap = new Map();
    orders.forEach((o) => o.items.forEach((it) => {
      const key = it.sellerSku || "（空 SKU）";
      if (!skuMap.has(key)) skuMap.set(key, { sellerSku: key, productName: it.productName, rec: it.rec, via: it.via, qty: 0, revenue: 0, costSum: 0, orderIds: new Set() });
      const s = skuMap.get(key);
      s.qty += it.qty; s.revenue += it.revenue; s.orderIds.add(o.orderId);
      if (it.matched) s.costSum += (it.rec.cost || 0) * it.qty;
    }));
    const skus = [...skuMap.values()].map((s) => {
      const avgDeal = s.qty > 0 ? s.revenue / s.qty : null;
      const weightG = s.rec && s.rec.weightKg != null ? s.rec.weightKg * 1000 : null;
      const shipUnit = weightG != null ? shipFeeNet(weightG) : 0;
      const cost = s.rec && s.rec.cost != null ? s.rec.cost : null;
      const breakeven = cost != null && R.total < 1 ? (cost + shipUnit) / (1 - R.total) : null;
      const variableProfit = s.revenue * (1 - R.total) - s.costSum; // 未含订单级运费分摊（多数档位净运费 0–5฿）
      return {
        sellerSku: s.sellerSku, productName: s.productName, via: s.via, matched: cost != null,
        qty: s.qty, orderCount: s.orderIds.size, revenue: s.revenue, avgDeal,
        cost, activityPrice: s.rec ? s.rec.activityPrice : null, breakeven,
        priceRatio: avgDeal != null && s.rec && s.rec.activityPrice ? avgDeal / s.rec.activityPrice : null,
        dealVsBreakeven: avgDeal != null && breakeven != null ? avgDeal - breakeven : null,
        variableProfit, margin: s.revenue > 0 ? variableProfit / s.revenue : null,
      };
    }).sort((a, b) => b.revenue - a.revenue);
    return { orders, skus, unmatched: [...unmatched.values()].sort((a, b) => b.revenue - a.revenue), matchedLines, totalLines, rates: R };
  }

  /* ================= 渲染：价格利润页 ================= */
  function renderProfitPage() {
    const kpiEl = document.getElementById("profit-kpi-row");
    const lossEl = document.getElementById("profit-loss-panel");
    const skuEl = document.getElementById("profit-sku-panel");
    const unmatchEl = document.getElementById("profit-unmatched-panel");
    const rateEl = document.getElementById("profit-rate-panel");
    if (!kpiEl && !lossEl && !skuEl) return;
    const settings = getProfitSettings();
    const ordersInScope = scopedRows("orders");
    if (rateEl) renderProfitRatePanel(rateEl, settings);
    if (!pricing && !ordersInScope.length) {
      if (kpiEl) kpiEl.innerHTML = "";
      if (lossEl) lossEl.innerHTML = emptyBlock(`<b>利润扫码待启用。</b>到「数据接入」页上传 ① 价格利润核算表（定价 / 费率 / 运费阶梯）② 每日订单明细（OrderSKUList）。上传后自动扫描每笔实际成交价，亏损订单立刻预警。`);
      if (skuEl) skuEl.innerHTML = "";
      if (unmatchEl) unmatchEl.innerHTML = "";
      return;
    }
    if (!pricing) {
      if (kpiEl) kpiEl.innerHTML = "";
      if (lossEl) lossEl.innerHTML = emptyBlock(`<b>还差一步：上传价格利润核算表。</b>订单明细已在档（${ordersInScope.length} 行），但没有成本与费率就无法判定亏损。到「数据接入」页上传「价格利润核算表」。`);
      if (skuEl) skuEl.innerHTML = "";
      if (unmatchEl) unmatchEl.innerHTML = "";
      return;
    }
    if (!ordersInScope.length) {
      if (kpiEl) kpiEl.innerHTML = "";
      if (lossEl) lossEl.innerHTML = emptyBlock(`<b>定价表已在档（${pricing.skus.length} 个 SKU）。</b>现在上传每日订单明细（OrderSKUList），系统立即扫描成交价并预警亏损。`);
      if (skuEl) skuEl.innerHTML = "";
      if (unmatchEl) unmatchEl.innerHTML = "";
      return;
    }
    const scan = profitScan();
    const dates = datasetDates("orders");
    const latest = dates[dates.length - 1] || "";
    const dayOrders = scan.orders.filter((o) => o.date === latest);
    const dayComplete = dayOrders.filter((o) => o.complete);
    const dayLoss = dayComplete.filter((o) => o.profit < 0).sort((a, b) => a.profit - b.profit);
    const dayRevenue = dayOrders.reduce((s, o) => s + o.revenue, 0);
    const dayProfit = dayComplete.reduce((s, o) => s + o.profit, 0);
    const lossSkus = scan.skus.filter((s) => s.matched && s.dealVsBreakeven != null && s.dealVsBreakeven < 0);
    const matchRate = scan.totalLines ? scan.matchedLines / scan.totalLines : 0;

    if (kpiEl) {
      kpiEl.innerHTML =
        kpiCard("扫码订单", `${dayOrders.length} 个`, `${latest} · 完成单口径`, "") +
        kpiCard("亏损订单", `${dayLoss.length} 个`, dayComplete.length ? `占可判定 ${(dayLoss.length / dayComplete.length * 100).toFixed(1)}%` : "—", dayLoss.length ? "#dc2626" : "#059669") +
        kpiCard("当日净利润", fmtThb(dayProfit), `成交 ${fmtThb(dayRevenue)} · 净利率 ${dayRevenue > 0 ? (dayProfit / dayRevenue * 100).toFixed(1) + "%" : "—"}`, dayProfit < 0 ? "#dc2626" : "#059669") +
        kpiCard("亏损价 SKU", `${lossSkus.length} 个`, "平均成交价 < 保本价", lossSkus.length ? "#d97706" : "#059669") +
        kpiCard("成本匹配率", `${(matchRate * 100).toFixed(1)}%`, `未匹配 ${scan.unmatched.length} 个 SKU`, matchRate < 0.8 ? "#d97706" : "#059669");
    }
    // 亏损预警
    if (lossEl) {
      const parts = [];
      if (dayLoss.length) {
        parts.push(`<div style="font-size:12px;color:#64748b;margin-bottom:8px;">${latest} · ${dayLoss.length} 个亏损订单（按亏损额排序，仅列成本已匹配的可判定订单）</div>
        <div class="desktop-table-wrap" style="max-height:320px;overflow:auto;"><table class="desktop-table">
          <thead><tr><th>订单号</th><th>SKU</th><th>成交价</th><th>平台费+运费</th><th>广告分摊</th><th>成本</th><th>净利润</th></tr></thead>
          <tbody>${dayLoss.slice(0, 30).map((o) => `<tr>
            <td style="font-family:monospace;font-size:11px;" title="${escapeHtml(o.orderId)}">…${escapeHtml(o.orderId.slice(-10))}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;" title="${escapeHtml(o.items.map((i) => i.sellerSku).join(" / "))}">${escapeHtml(o.items.map((i) => i.sellerSku).join(" / ").slice(0, 40))}</td>
            <td>${fmtThb(o.revenue)}</td>
            <td>${fmtThb(o.platformFee)}</td>
            <td>${fmtThb(o.adsCost)}</td>
            <td>${fmtThb(o.cost)}</td>
            <td style="color:#dc2626;font-weight:700;">${fmtThb(o.profit)}</td>
          </tr>`).join("")}</tbody></table></div>
        ${dayLoss.length > 30 ? `<div style="font-size:12px;color:#94a3b8;margin-top:6px;">仅展示前 30 个，共 ${dayLoss.length} 个。</div>` : ""}`);
      } else if (dayComplete.length) {
        parts.push(`<div class="ops-empty">${latest} 可判定订单 ${dayComplete.length} 个，<b>无亏损订单</b>。👍</div>`);
      } else {
        parts.push(`<div class="ops-empty">${latest} 暂无可判定订单（SKU 成本均未匹配）。先在下方「未匹配 SKU」补成本。</div>`);
      }
      if (lossSkus.length) {
        parts.push(`<div style="margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9;">
          <div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:8px;">⚠️ 全周期亏损价 SKU（平均成交价低于保本价，按缺口排序）</div>
          ${lossSkus.slice(0, 8).map((s) => `<div style="font-size:12px;color:#475569;line-height:1.9;">🔴 <strong>${escapeHtml(s.sellerSku)}</strong>：均价 ${fmtThb(s.avgDeal)} vs 保本 ${fmtThb(s.breakeven)}（每件约亏 ${fmtThb(-(s.dealVsBreakeven))}）· ${s.orderCount} 单 ${s.qty} 件 → 建议提价至 ${fmtThb(s.breakeven)} 以上或停投</div>`).join("")}
        </div>`);
      }
      lossEl.innerHTML = parts.join("");
    }
    // SKU 价格体检
    if (skuEl) {
      const rows = scan.skus.slice(0, 60);
      skuEl.innerHTML = `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">全部导入周期 · 按成交额降序 · 净利润未含订单级运费分摊（多数档位净运费 0–5฿）</div>
      <div class="desktop-table-wrap" style="max-height:420px;overflow:auto;"><table class="desktop-table">
        <thead><tr><th>Seller SKU</th><th>成本</th><th>活动价</th><th>保本价</th><th>平均成交价</th><th>成交价/活动价</th><th>单量</th><th>成交额</th><th>净利润</th><th>状态</th></tr></thead>
        <tbody>${rows.map((s) => {
          const status = !s.matched ? `<span class="tag tag-gray">未匹配</span>`
            : s.dealVsBreakeven != null && s.dealVsBreakeven < 0 ? `<span class="tag tag-red">亏损价</span>`
            : s.margin != null && s.margin < 0.05 ? `<span class="tag tag-yellow">贴线</span>`
            : `<span class="tag tag-green">健康</span>`;
          return `<tr>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(s.productName || s.sellerSku)}"><strong>${escapeHtml(s.sellerSku)}</strong>${s.via === "patch" ? ' <span class="tag tag-blue" style="font-size:10px;">手动补</span>' : s.via === "base" ? ' <span class="tag tag-gray" style="font-size:10px;">基础款</span>' : ""}</td>
            <td>${s.cost != null ? fmtThb(s.cost) : "—"}</td>
            <td>${s.activityPrice != null ? fmtThb(s.activityPrice) : "—"}</td>
            <td>${s.breakeven != null ? fmtThb(s.breakeven) : "—"}</td>
            <td style="font-weight:600;${s.dealVsBreakeven != null && s.dealVsBreakeven < 0 ? "color:#dc2626;" : ""}">${s.avgDeal != null ? fmtThb(s.avgDeal) : "—"}</td>
            <td>${s.priceRatio != null ? (s.priceRatio * 100).toFixed(0) + "%" : "—"}</td>
            <td>${s.orderCount} 单 / ${s.qty} 件</td>
            <td>${fmtThb(s.revenue)}</td>
            <td style="font-weight:600;${s.variableProfit < 0 ? "color:#dc2626;" : "color:#059669;"}">${s.matched ? fmtThb(s.variableProfit) : "—"}</td>
            <td>${status}</td>
          </tr>`;
        }).join("")}</tbody></table></div>
      ${scan.skus.length > 60 ? `<div style="font-size:12px;color:#94a3b8;margin-top:6px;">仅展示前 60 个，共 ${scan.skus.length} 个 SKU。</div>` : ""}`;
    }
    // 未匹配 SKU + 手动补成本
    if (unmatchEl) {
      if (!scan.unmatched.length) {
        unmatchEl.innerHTML = `<div class="ops-empty">全部订单行均已匹配成本。👍</div>`;
      } else {
        unmatchEl.innerHTML = `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">这些 Seller SKU 在定价表里找不到（按成交额排序）。补上成本后立即参与利润判定，<b>补一次永久记住</b>（存本机浏览器）。</div>
        <div class="desktop-table-wrap" style="max-height:360px;overflow:auto;"><table class="desktop-table">
          <thead><tr><th>Seller SKU</th><th>品名</th><th>行数</th><th>件数</th><th>成交额</th><th>补成本(฿/件)</th><th>重量(kg,选填)</th><th></th></tr></thead>
          <tbody>${scan.unmatched.slice(0, 30).map((u) => `<tr>
            <td style="font-size:12px;"><strong>${escapeHtml(u.sellerSku)}</strong></td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;" title="${escapeHtml(u.productName || "")}">${escapeHtml((u.productName || "—").slice(0, 30))}</td>
            <td>${u.lines}</td>
            <td>${u.qty}</td>
            <td>${fmtThb(u.revenue)}</td>
            <td><input type="number" min="0" step="0.01" class="profit-patch-cost" data-sku="${escapeHtml(u.sellerSku)}" placeholder="如 25.5" style="width:90px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;"></td>
            <td><input type="number" min="0" step="0.01" class="profit-patch-weight" data-sku="${escapeHtml(u.sellerSku)}" placeholder="选填" style="width:70px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;"></td>
            <td><button class="btn btn-primary profit-patch-save" data-sku="${escapeHtml(u.sellerSku)}" style="padding:4px 10px;font-size:12px;">保存</button></td>
          </tr>`).join("")}</tbody></table></div>
        ${scan.unmatched.length > 30 ? `<div style="font-size:12px;color:#94a3b8;margin-top:6px;">仅展示前 30 个，共 ${scan.unmatched.length} 个未匹配 SKU。</div>` : ""}`;
      }
    }
  }

  function renderProfitRatePanel(el, settings) {
    const R = profitRates();
    const src = pricing ? `费率来自「${pricing.fileName}」` : "定价表未导入，当前展示内置默认费率";
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
        <div style="font-size:12px;color:#475569;line-height:2;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">📐 当前判定口径 <span style="font-weight:400;color:#94a3b8;">${escapeHtml(src)}</span></div>
          固定费率 ${(R.fixed * 100).toFixed(2)}%（交易 ${(R.raw.transaction * 100).toFixed(2)}% + Shop佣金 ${(R.raw.shopCommission * 100).toFixed(2)}% + 增长服务 ${(R.raw.growth * 100).toFixed(2)}% + 基建 ${(R.raw.infra * 100).toFixed(2)}%${R.flags.miaosha ? " + 秒杀" : ""}${R.flags.live ? " + 直播" : ""}）<br>
          联盟佣金 ${(R.affRate * 100).toFixed(2)}% · 广告分摊 ${(R.adsShare * 100).toFixed(1)}% · 人员综合 ${(R.staff * 100).toFixed(1)}%<br>
          <strong>总变动费率 ${(R.total * 100).toFixed(2)}%</strong> + 商家净运费（按订单总重走阶梯，多数档位 0–5฿）
        </div>
        <div style="font-size:12px;color:#475569;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:6px;">⚙️ 场景调整（存本机，立即重算）</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;align-items:center;gap:8px;">广告分摊占成交价
              <input type="number" min="0" max="50" step="0.5" id="profit-set-ads" value="${(settings.adsShare * 100).toFixed(1)}" style="width:70px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;"> %
            </label>
            <label style="display:flex;align-items:center;gap:8px;">联盟佣金模式
              <select id="profit-set-aff" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;background:#fff;">
                <option value="auto" ${settings.affMode === "auto" ? "selected" : ""}>按定价表全局设置（当前 ${(R.affRate * 100).toFixed(0)}%）</option>
                <option value="ad" ${settings.affMode === "ad" ? "selected" : ""}>全部按联盟广告佣金（${(R.raw.affAdCommission * 100).toFixed(0)}%）</option>
                <option value="aff" ${settings.affMode === "aff" ? "selected" : ""}>全部按联盟佣金（${(R.raw.affCommission * 100).toFixed(0)}%）</option>
                <option value="none" ${settings.affMode === "none" ? "selected" : ""}>不计联盟佣金</option>
              </select>
            </label>
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="profit-set-staff" ${settings.includeStaff ? "checked" : ""}> 计入人员&amp;综合成本（成交价 × ${(R.raw.staff * 100).toFixed(1)}%）
            </label>
          </div>
        </div>
      </div>`;
  }

  // —— 核算表导入（整表覆盖，以最新上传为准）——
  async function handlePricingImport(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const status = document.getElementById("pricing-upload-status");
    const setStatus = (text, cls) => { if (status) { status.className = `tag ${cls || "tag-yellow"}`; status.textContent = text; } };
    setStatus("正在解析…", "tag-yellow");
    try {
      const notes = [];
      for (const file of files) {
        const result = await parsePricing(file);
        pricing = result.pricing;
        pricingIndex = null;
        notes.push(`${file.name}：${result.note}`);
      }
      await saveV33();
      window.localStorage.setItem("tiktok-real-data-state-v4", "imported");
      window.dispatchEvent(new CustomEvent("real-data-imported"));
      setStatus(`已导入 · ${pricing.skus.length} 个 SKU`, "tag-green");
      renderAllV33();
      renderFreshnessBadges();
      bridge.renderPriorityPanel();
      window.alert(`✅ 价格利润核算表导入完成\n\n${notes.join("\n")}\n\n判定口径：固定费率 + 联盟佣金 + 广告分摊 + 人员成本 + 运费阶梯。上传每日订单明细后自动扫描成交价。`);
    } catch (error) {
      setStatus("导入失败", "tag-red");
      window.alert(`❌ 导入失败\n\n${error.message || "无法识别该文件"}`);
    } finally {
      event.target.value = "";
    }
  }

  // —— 今日优先处理 · 利润 ——
  function profitPriorityProviderV33() {
    const ordersInScope = scopedRows("orders");
    if (!pricing && !ordersInScope.length) {
      return { items: [], emptyHtml: `<b>利润扫码未启用。</b>到「数据接入」页上传价格利润核算表 + 每日订单明细后，这里自动推送亏损预警。` };
    }
    if (!pricing) {
      return { items: [{ sev: "medium", title: "📋 订单明细已在档，缺价格利润核算表", body: "【数据】订单明细已导入，但没有成本与费率无法判定亏损。<br>【建议动作】到「数据接入」页上传「价格利润核算表」。", tags: ["利润"] }], emptyHtml: "" };
    }
    if (!ordersInScope.length) {
      return { items: [{ sev: "medium", title: "📋 定价表已在档，缺订单明细", body: `【数据】${pricing.skus.length} 个 SKU 定价已加载。<br>【建议动作】上传前日订单明细（OrderSKUList），立即扫描成交价。`, tags: ["利润"] }], emptyHtml: "" };
    }
    const scan = profitScan();
    const latest = datasetDates("orders").pop() || "";
    const dayOrders = scan.orders.filter((o) => o.date === latest && o.complete);
    const dayLoss = dayOrders.filter((o) => o.profit < 0).sort((a, b) => a.profit - b.profit);
    const items = [];
    if (dayLoss.length) {
      const totalLoss = dayLoss.reduce((s, o) => s + o.profit, 0);
      items.push({
        sev: "high",
        title: `🔴 ${latest} 亏损订单 ${dayLoss.length} 个 · 合计 ${fmtThb(totalLoss)}`,
        body: `【数据】${dayLoss.slice(0, 3).map((o) => `单 …${o.orderId.slice(-8)} ${fmtThb(o.profit)}`).join("；")}${dayLoss.length > 3 ? ` 等 ${dayLoss.length} 单` : ""}。<br>【建议动作】到「价格利润」页逐单核对：是否券后价 / 秒杀价击穿保本；对应 SKU 提价或停投广告。`,
        tags: ["利润预警"],
      });
    }
    const lossSkus = scan.skus.filter((s) => s.matched && s.dealVsBreakeven != null && s.dealVsBreakeven < 0).sort((a, b) => a.dealVsBreakeven - b.dealVsBreakeven);
    lossSkus.slice(0, 3).forEach((s) => {
      items.push({
        sev: "high",
        title: `🔴 亏损价 SKU · ${s.sellerSku}（均价 ${fmtThb(s.avgDeal)} < 保本 ${fmtThb(s.breakeven)}）`,
        body: `【数据】${s.orderCount} 单 ${s.qty} 件，平均成交价为活动价 ${s.priceRatio != null ? (s.priceRatio * 100).toFixed(0) + "%" : "—"}。<br>【建议动作】提价到 ${fmtThb(s.breakeven)} 以上，或检查平台券 / 秒杀设置；持续亏损则下架该规格。`,
        tags: ["利润预警"],
      });
    });
    if (scan.unmatched.length) {
      items.push({
        sev: "medium",
        title: `⚪ ${scan.unmatched.length} 个 SKU 未匹配成本（${scan.totalLines ? ((1 - scan.matchedLines / scan.totalLines) * 100).toFixed(0) : 0}% 订单行待补）`,
        body: `【数据】${scan.unmatched.slice(0, 3).map((u) => u.sellerSku).join("、")}${scan.unmatched.length > 3 ? " 等" : ""} 在定价表找不到。<br>【建议动作】到「价格利润」页底部补成本，补一次永久记住。`,
        tags: ["数据补齐"],
      });
    }
    return { items, emptyHtml: `${latest} 无亏损订单，成交价格全线健康。👍` };
  }

  window.OPS_EXT_PRIORITY_PROVIDERS = {
    creator: creatorPriorityProviderV33,
    ads: adsPriorityProviderV33,
    video: videoPriorityProviderV33,
    profit: profitPriorityProviderV33,
  };

  /* ================= OPS_EXT 契约（供 dashboard / index 调用） ================= */
  /* ================= 渲染：经营总览 · 成交来源占比 ================= */
  function renderSourceSplit() {
    const el = document.getElementById("source-split-panel");
    if (!el) return;
    const overviewRows = scopedOverviewRows("creatorDaily");
    const detailedRows = scopedRows("creatorDaily");
    const creatorRows = overviewRows.length ? overviewRows : detailedRows;
    if (!creatorRows.length) {
      const loading = window.TIKTOK_CLOUD_SNAPSHOT?.published && !window.OPS_V33_READY;
      el.innerHTML = `<div class="ops-empty">${loading ? "正在读取云端达人日快照，请稍候…" : "当前店铺和日期范围暂无可拆分的达人订单。"}</div>`;
      return;
    }
    const dates = [...new Set(creatorRows.map((r) => r.date).filter(Boolean))].sort();
    const first = dates[0];
    const latest = dates[dates.length - 1];
    const rows = creatorRows;
    const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
    const total = sum("gmv");
    const parts = [
      { label: "🎬 短视频", value: sum("videoGmv"), color: "#38bdf8" },
      { label: "📺 直播", value: sum("liveGmv"), color: "#8b5cf6" },
      { label: "🛒 商品卡", value: sum("cardGmv"), color: "#10b981" },
    ];
    const known = parts.reduce((s, p) => s + p.value, 0);
    parts.push({ label: "📦 其他/未拆分", value: Math.max(0, total - known), color: "#94a3b8" });
    if (total <= 0) {
      el.innerHTML = `<div class="ops-empty">${latest} 达人订单 GMV 为 0，暂无成交来源可拆分。</div>`;
      return;
    }
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;padding-top:6px;">` +
      parts.map((p) => {
        const pct = Math.round((p.value / total) * 100);
        return `<div><div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;"><span>${p.label}</span><span style="font-weight:700;">${pct}% · ${fmtThb(p.value)}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${p.color};"></div></div></div>`;
      }).join("") +
      `</div><div style="margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">${first === latest ? latest : `${first} 至 ${latest}`} · 区间累计联盟口径（达人订单合计 ${fmtThb(total)}），不含自营与其他渠道。</div>`;
  }
  function latestRowsPerStore(rows) {
    const latestByStore = new Map();
    rows.forEach((row) => {
      if (!row.date) return;
      const store = row.store || "未标注店铺";
      if (!latestByStore.has(store) || row.date > latestByStore.get(store)) latestByStore.set(store, row.date);
    });
    return rows.filter((row) => latestByStore.get(row.store || "未标注店铺") === row.date);
  }
  function renderOverviewOperationalCards() {
    const creatorValue = document.getElementById("overview-creator-value");
    const creatorMeta = document.getElementById("overview-creator-meta");
    const adsValue = document.getElementById("overview-ads-value");
    const adsMeta = document.getElementById("overview-ads-meta");
    const reportDraft = document.getElementById("overview-report-draft");
    if (!creatorValue && !adsValue && !reportDraft) return;
    const creatorOverviewRows = scopedOverviewRows("creatorDaily");
    const detailedCreatorRows = scopedRows("creatorDaily");
    const creatorRows = creatorOverviewRows.length ? creatorOverviewRows : detailedCreatorRows;
    const latestCreatorRows = latestRowsPerStore(creatorRows);
    const activeCreators = new Set(latestCreatorRows
      .filter((row) => Number(row.orders || 0) > 0 || Number(row.gmv || 0) > 0)
      .map((row) => `${row.store || "未标注店铺"}|${row.creator || "未标注达人"}`));
    const creatorGmv = creatorRows.reduce((sum, row) => sum + Number(row.gmv || 0), 0);
    const creatorDates = creatorRows.map((row) => row.date).filter(Boolean).sort();
    const latestCreator = creatorDates[creatorDates.length - 1] || "";

    const adsOverviewRows = scopedOverviewRows("adCreatives");
    const detailedAdsRows = scopedRows("adCreatives");
    const adsRows = adsOverviewRows.length ? adsOverviewRows : detailedAdsRows;
    const adSpend = adsRows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    const adRevenue = adsRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const adRoi = adSpend > 0 ? adRevenue / adSpend : null;
    const adDates = adsRows.map((row) => row.date).filter(Boolean).sort();
    const latestAd = adDates[adDates.length - 1] || "";
    const latest = [latestCreator, latestAd].filter(Boolean).sort().pop() || "";
    const summaryCreatorCount = latestCreatorRows.some((row) => row.activeCreators != null)
      ? latestCreatorRows.reduce((sum, row) => sum + Number(row.activeCreators || 0), 0)
      : activeCreators.size;
    const analyticsLoading = window.TIKTOK_CLOUD_SNAPSHOT?.published && !window.OPS_V33_READY && !creatorRows.length && !adsRows.length;

    if (creatorValue) creatorValue.textContent = creatorRows.length ? formatNumber(summaryCreatorCount, 0) : analyticsLoading ? "读取中" : "待导入";
    if (creatorMeta) creatorMeta.innerHTML = creatorRows.length
      ? `最新日动销达人 · 区间 GMV ${fmtThb(creatorGmv)}<br><span style="color:#64748b;font-weight:600;">区间至 ${latestCreator}</span>`
      : analyticsLoading ? "正在读取云端达人数据…" : "当前范围暂无达人订单";
    if (adsValue) adsValue.textContent = adsRows.length ? fmtUsd(adSpend) : analyticsLoading ? "读取中" : "待导入";
    if (adsMeta) adsMeta.innerHTML = adsRows.length
      ? `区间广告消耗 · GMV ${fmtUsd(adRevenue)}<br>ROI ${adRoi == null ? "待导入" : `${adRoi.toFixed(2)}x`}`
      : analyticsLoading ? "正在读取云端广告数据…<br>ROI 待计算" : "当前范围暂无广告数据<br>ROI 待导入";
    if (reportDraft) {
      reportDraft.textContent = analyticsLoading
        ? "正在读取云端达人、广告和视频数据，请稍候…"
        : latest
        ? `已加载真实数据（最新日期 ${latest}）\n达人：${formatNumber(summaryCreatorCount, 0)} 位动销达人，GMV ${fmtThb(creatorGmv)}\n广告：消耗 ${fmtUsd(adSpend)}，GMV ${fmtUsd(adRevenue)}，ROI ${adRoi == null ? "待导入" : `${adRoi.toFixed(2)}x`}\n以上为导入数据摘要；点击“重新生成”后再生成日报草稿。`
        : "暂无真实数据，导入后生成日报草稿。";
    }
  }
  let fullRenderTimer = null;
  function renderAllV33(options = {}) {
    renderOverviewOperationalCards();
    renderSourceSplit();
    if (options.overviewOnly) return;
    renderBdPageV33();
    renderAdsPageV33();
    renderAssetLibraryV33();
    renderVideosPageV33();
    renderAlertExtrasV33();
    renderProfitPage();
    const searchInput = document.getElementById("alert-search-input");
    if (searchInput && searchInput.value.trim()) renderTrendSearchV33(searchInput.value);
  }
  function scheduleFullRender() {
    if (fullRenderTimer != null) return;
    // Let the changed filter and lightweight overview paint before rebuilding
    // the large detail panels from tens of thousands of rows.
    fullRenderTimer = window.setTimeout(() => {
      fullRenderTimer = null;
      renderAllV33();
    }, 0);
  }
  function hasData(key) {
    if (key === "pricing") return Boolean(pricing);
    if (Object.prototype.hasOwnProperty.call(v33, key)) return v33[key].length > 0;
    // 兼容旧键名（index.html 里 pageReady 等还在用）
    if (key === "creators") return v33.creatorDaily.length > 0;
    if (key === "ads") return v33.adCreatives.length > 0;
    if (key === "videos") return v33.affVideos.length > 0 || v33.selfVideos.length > 0;
    if (key === "assets") return buildAssetLibrary().length > 0;
    return false;
  }
  window.OPS_EXT = {
    render: renderAllV33,
    scheduleFullRender,
    hasImportedData: (key) => key ? hasData(key) : (Object.keys(v33).some((k) => v33[k].length > 0) || Boolean(pricing)),
    clearDataset: async (key) => {
      if (key === "pricing") {
        pricing = null;
        pricingIndex = null;
        await saveV33();
        renderAllV33();
        renderFreshnessBadges();
        bridge.renderPriorityPanel();
        return;
      }
      const map = { creators: "creatorDaily", ads: "adCreatives", videos: "affVideos", assets: null };
      const target = Object.prototype.hasOwnProperty.call(v33, key) ? key : map[key];
      if (key === "assets") {
        meta.removedAssets = [];
        await saveV33();
        try { indexedDB.deleteDatabase(VIDEO_DB_NAME); } catch (e) {}
        renderAllV33();
        renderFreshnessBadges();
        bridge.renderPriorityPanel();
        return;
      }
      if (target === null) return;
      if (!target) return;
      v33[target] = [];
      invalidateLatestDataDate();
      delete meta.lastImport[target];
      await saveV33();
      renderAllV33();
      renderFreshnessBadges();
      bridge.renderPriorityPanel();
    },
    clearAll: async () => {
      v33 = EMPTY_DATA();
      invalidateLatestDataDate();
      meta = { lastImport: {}, removedAssets: [] };
      pricing = null;
      pricingIndex = null;
      await saveV33();
      try { indexedDB.deleteDatabase(VIDEO_DB_NAME); } catch (e) {}
      renderAllV33();
      renderFreshnessBadges();
      bridge.renderPriorityPanel();
    },
    renderFreshness: renderFreshnessBadges,
  };
  window.OPS_V33 = {
    getData: () => v33,
    getRows: (datasetKey) => scopedRows(datasetKey),
    getScope: () => ({
      store: document.getElementById("store-filter")?.value || "all",
      bounds: selectedScopeBounds(),
    }),
    getPricing: () => pricing,
  };

  /* ================= 绑定与初始化 ================= */
  function bindV33() {
    const bind = (id, handler) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener("change", handler);
    };
    bind("bd-file-input", (e) => handleV33Import(e, "creatorDaily", "bd-upload-status"));
    bind("afforder-file-input", (e) => handleV33Import(e, "affOrders", "afforder-upload-status"));
    bind("sample-file-input", (e) => handleV33Import(e, "samples", "sample-upload-status"));
    bind("ads-file-input", (e) => handleV33Import(e, "adCreatives", "ads-upload-status"));
    bind("affvideo-file-input", (e) => handleV33Import(e, "affVideos", "affvideo-upload-status"));
    bind("videos-file-input", (e) => handleV33Import(e, "selfVideos", "videos-upload-status"));
    bind("asset-video-input", handleAssetVideoImport);
    bind("order-file-input", (e) => handleV33Import(e, "orders", "order-upload-status"));
    bind("pricing-file-input", handlePricingImport);
    bind("unified-data-file-input", handleUnifiedImport);
    bind("unified-data-directory-input", handleUnifiedImport);
    // 利润页：手动补成本（事件委托，内容动态渲染）
    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(".profit-patch-save") : null;
      if (!btn) return;
      const sku = btn.getAttribute("data-sku") || "";
      const costInput = document.querySelector(`.profit-patch-cost[data-sku="${CSS.escape(sku)}"]`);
      const weightInput = document.querySelector(`.profit-patch-weight[data-sku="${CSS.escape(sku)}"]`);
      const cost = costInput ? cleanNum(costInput.value) : null;
      if (cost == null || cost < 0) { window.alert("请输入有效的成本价（฿/件）"); return; }
      const weightKg = weightInput ? cleanNum(weightInput.value) : null;
      setCostPatch(sku, cost, weightKg);
      renderAllV33();
      bridge.renderPriorityPanel();
    });
    // 利润页：场景设置（改立即重算）
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!t || !t.id) return;
      if (t.id === "profit-set-ads") {
        const v = cleanNum(t.value);
        if (v != null && v >= 0 && v <= 50) { saveProfitSettings({ adsShare: v / 100 }); renderAllV33(); bridge.renderPriorityPanel(); }
      } else if (t.id === "profit-set-aff") {
        saveProfitSettings({ affMode: t.value });
        renderAllV33();
        bridge.renderPriorityPanel();
      } else if (t.id === "profit-set-staff") {
        saveProfitSettings({ includeStaff: t.checked });
        renderAllV33();
        bridge.renderPriorityPanel();
      }
    });
    const searchInput = document.getElementById("alert-search-input");
    if (searchInput) searchInput.addEventListener("input", () => renderTrendSearchV33(searchInput.value));
    // 节奏切换（自助）
    document.querySelectorAll("select[data-cadence]").forEach((sel) => {
      sel.addEventListener("change", () => {
        setCadence(sel.getAttribute("data-cadence"), sel.value);
        renderFreshnessBadges();
      });
    });
  }

  // 先用轻量摘要填充总览，避免用户等待全部明细解析完成才看到核心指标。
  renderOverviewOperationalCards();
  renderSourceSplit();
  loadV33().then(() => {
    bindV33();
    window.OPS_V33_READY = true;
    renderAllV33();
    renderFreshnessBadges();
    window.dispatchEvent(new CustomEvent("real-data-ready"));
    bridge.renderPriorityPanel();
  });
})();
