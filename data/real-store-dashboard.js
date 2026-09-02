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

  /* ========== 自适应字段映射层：中控台适应店铺数据，不要求固定模板 ========== */
  const HEADER_MAPPING_STORAGE_KEY = "tiktok-header-mapping-v1";
  const HEADER_MAPPING_IGNORE = "__ignore__";

  function normalizeHeaderText(value) {
    return String(value ?? "")
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .toLowerCase()
      .replace(/（/g, "(").replace(/）/g, ")")
      .replace(/％/g, "%")
      .replace(/[\s_\-·:：,，.。/\\|]+/g, "")
      .trim();
  }

  // 标准字段同义词库：中文 / 英文 / 常见简写，全部按 normalizeHeaderText 后的形态匹配
  const HEADER_SYNONYMS = {
    "商品 ID": ["商品id", "product id", "productid", "item id", "itemid", "pid", "spu id", "spuid", "商品编号", "产品id", "产品编号", "goods id", "goodsid"],
    "商品名": ["product name", "productname", "商品名称", "产品名称", "商品标题", "产品标题", "item name", "itemname", "product title", "title", "product", "goods name", "goodsname"],
    "发品状态": ["status", "商品状态", "产品状态", "listing status", "listingstatus", "状态", "上架状态"],
    "GMV 区间": ["gmv区间", "gmv range", "gmvrange", "gmv band", "gmvband"],
    "GMV": ["gmv", "成交额", "销售额", "成交金额", "交易总额", "gross merchandise value", "grossmerchandisevalue", "gmv(thb)", "gmvthb", "gmv($)", "总成交额"],
    "订单数": ["orders", "order", "订单", "订单量", "order count", "ordercount", "total orders", "totalorders"],
    "SKU 订单数": ["sku orders", "skuorders", "sku订单", "sku 订单", "sku order count", "skuordercount"],
    "商品成交件数": ["units", "items sold", "itemssold", "成交件数", "销量", "销售件数", "件数", "sold units", "soldunits", "units sold", "unitssold", "product units", "productunits"],
    "预计客户数": ["customers", "buyers", "客户数", "买家数", "estimated customers", "estimatedcustomers", "est. customers"],
    "平均订单金额（SKU 订单）": ["average order value", "averageordervalue", "avg order value", "avgordervalue", "aov", "客单价", "平均订单金额", "平均订单价值"],
    "商品曝光次数": ["impressions", "product impressions", "productimpressions", "曝光", "曝光量", "曝光次数", "商品曝光", "商品曝光量", "总曝光", "总曝光量", "views", "exposure"],
    "商品点击量": ["clicks", "product clicks", "productclicks", "点击", "点击量", "点击次数", "商品点击", "商品点击量", "总点击", "总点击量"],
    "商品点击率": ["ctr", "点击率", "click-through rate", "click through rate", "clickthroughrate", "product ctr", "productctr"],
    "加购次数": ["add to cart", "addtocart", "atc", "加购", "加购数", "adds to cart", "addstocart", "add-to-cart", "add to carts", "addtocarts", "cart adds", "cartadds"],
    "加购率": ["atc rate", "atcrate", "加购率", "add to cart rate", "addtocartrate", "add-to-cart rate"],
    "CTOR（SKU 订单）": ["ctor", "ctor(sku orders)", "ctor(skuorders)", "ctor(sku 订单)", "ctor(sku订单)", "点击成交转化率", "点击下单转化率"],
    "去重商品曝光次数": ["unique impressions", "uniqueimpressions", "去重曝光", "去重曝光量", "去重曝光次数", "unique exposure", "uniqueexposure"],
    "去重点击次数": ["unique clicks", "uniqueclicks", "去重点击", "去重点击量", "去重点击量"],
    "去重点击率": ["unique ctr", "uniquectr", "去重ctr", "去重点击率", "去重点击率"],
    "已加购的用户数": ["atc users", "atcusers", "加购用户数", "已加购用户数", "add-to-cart users", "addtocartusers"],
    "去重加购率": ["unique atc rate", "uniqueatcrate", "去重加购率"],
    "去重点击成交转化率（SKU 订单）": ["cvr", "转化率", "成交转化率", "点击转化率", "conversion rate", "conversionrate", "unique click cvr", "uniqueclickcvr", "去重cvr", "去重转化率"],
    "税费": ["tax", "税", "税费", "税金"],
    "运费": ["shipping", "运费", "shipping fee", "shippingfee", "shipping cost", "shippingcost"],
    "退款金额": ["refund", "refund amount", "refundamount", "退款", "退款额", "refunds"],
    "已退款的商品件数": ["refunded units", "refundedunits", "退款件数", "已退款件数", "refund units", "refundunits"],
    "退款客户数": ["refund customers", "refundcustomers", "退款客户数", "退款买家数"],
    "商城页 GMV": ["mall gmv", "mallgmv", "商城gmv", "商城页gmv", "shop tab gmv", "shoptabgmv", "商城成交额"],
    "新直播场次": ["new live sessions", "newlivesessions", "直播场次", "新开播场次", "live sessions", "livesessions"],
    "新视频数": ["new videos", "newvideos", "新视频", "发布视频数", "video count", "videocount"],
    "已发布内容的日均达人数": ["avg daily reach", "avgdailyreach", "日均达人数", "日均触达", "average daily reach"],
    "日期": ["日期", "date", "day", "统计日期", "数据日期", "report date", "reportdate", "日期时间", "时间", "dt"],
    "店铺": ["店铺", "店铺名称", "shop", "shop name", "shopname", "store", "store name", "storename", "卖家", "seller", "商家", "店铺名"],
  };

  function readLearnedHeaderMappings() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(HEADER_MAPPING_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveLearnedHeaderMapping(rawHeader, canonicalName) {
    const mappings = readLearnedHeaderMappings();
    mappings[normalizeHeaderText(rawHeader)] = canonicalName;
    try {
      window.localStorage.setItem(HEADER_MAPPING_STORAGE_KEY, JSON.stringify(mappings));
    } catch (error) {
      console.warn("Unable to persist header mapping", error);
    }
  }

  // 按优先级解析某标准字段在表头中的所有列下标（保持出现顺序，供第 N 组读取）
  function resolveHeaderIndices(headers, canonicalName) {
    if (!Array.isArray(headers)) return [];
    const normalizedHeaders = headers.map((header) => String(header ?? "").trim());
    // 第 1 层：精确匹配（保持原有 176 字段分组语义）
    let indices = normalizedHeaders.map((header, index) => (header === canonicalName ? index : -1)).filter((index) => index >= 0);
    if (indices.length) return indices;
    // 第 2 层：规范化后精确匹配（全半角、大小写、空格、括号差异）
    const target = normalizeHeaderText(canonicalName);
    indices = normalizedHeaders.map((header, index) => (normalizeHeaderText(header) === target ? index : -1)).filter((index) => index >= 0);
    if (indices.length) return indices;
    // 第 3 层：用户指认过的记忆映射
    const learned = readLearnedHeaderMappings();
    indices = normalizedHeaders.map((header, index) => (learned[normalizeHeaderText(header)] === canonicalName ? index : -1)).filter((index) => index >= 0);
    if (indices.length) return indices;
    // 第 4 层：同义词库
    const synonyms = (HEADER_SYNONYMS[canonicalName] || []).map((item) => normalizeHeaderText(item));
    if (!synonyms.length) return [];
    indices = normalizedHeaders.map((header, index) => (synonyms.includes(normalizeHeaderText(header)) ? index : -1)).filter((index) => index >= 0);
    return indices;
  }

  function resolveHeaderIndex(headers, canonicalName, occurrence = 0) {
    const indices = resolveHeaderIndices(headers, canonicalName);
    return indices.length > occurrence ? indices[occurrence] : -1;
  }

  // 标准字段全集：以内嵌公开快照的 176 个来源字段为准（即平台标准导出的列名），同义词库负责非标准写法
  function standardCanonicalHeaders() {
    const fromData = sourceData && sourceData.stores && sourceData.stores[0] && sourceData.stores[0].snapshots && sourceData.stores[0].snapshots[0];
    const headers = fromData && fromData.sourceHeaders;
    return Array.isArray(headers) && headers.length ? headers : Object.keys(HEADER_SYNONYMS);
  }

  // 生成单文件的字段识别报告：匹配上的列与未识别的列
  function buildHeaderMatchReport(headers) {
    const learned = readLearnedHeaderMappings();
    const canonicalNames = standardCanonicalHeaders();
    const matched = [];
    const unmatched = [];
    const ignored = [];
    headers.forEach((header, index) => {
      const raw = String(header ?? "").trim();
      if (!raw) return;
      const normalized = normalizeHeaderText(raw);
      if (learned[normalized] === HEADER_MAPPING_IGNORE) {
        ignored.push({ raw, index });
        return;
      }
      const canonical = learned[normalized] && learned[normalized] !== HEADER_MAPPING_IGNORE
        ? learned[normalized]
        : canonicalNames.find((name) => resolveHeaderIndices([raw], name).length > 0);
      if (canonical) matched.push({ raw, canonical, index });
      else unmatched.push({ raw, index });
    });
    return { matched, unmatched, ignored };
  }


  // 从文件名推断日期：支持 YYYYMMDD / YYYY-MM-DD / YYYY_MM_DD 等写法
  function parseDateFromFilename(fileName) {
    const name = String(fileName);
    const dashed = name.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/);
    if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
    const compact = name.match(/(20\d{2})(\d{2})(\d{2})/);
    if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
    return "";
  }

  // 从表格内容推断日期：找"日期"类列，若整列只有一个日期值则采用
  function inferDateFromSheet(headers, dataRows) {
    const dateIndex = resolveHeaderIndex(headers, "日期");
    if (dateIndex < 0) return "";
    const values = [...new Set(dataRows.map((row) => parseDateCell(row[dateIndex])).filter(Boolean))];
    return values.length === 1 ? values[0] : "";
  }

  function parseDateCell(value) {
    if (value == null || value === "") return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const text = String(value).trim();
    const match = text.match(/(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    const compact = text.match(/^(20\d{2})(\d{2})(\d{2})$/);
    if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
    return "";
  }

  function parseStoreFromFilename(fileName) {
    const match = String(fileName).match(/^店铺名[:：](.+?)-product_list_\d{8}\.(?:xlsx|xls|csv)$/i);
    if (match) return match[1].trim();
    return "";
  }

  // 店铺名推断：文件名「店铺名：X-...」→ 表内店铺列唯一值 → 文件名主体（去掉日期与扩展名）
  function inferStoreName(fileName, headers, dataRows) {
    const fromFile = parseStoreFromFilename(fileName);
    if (fromFile) return fromFile;
    const storeIndex = resolveHeaderIndex(headers, "店铺");
    if (storeIndex >= 0) {
      const values = [...new Set(dataRows.map((row) => String(row[storeIndex] ?? "").trim()).filter(Boolean))];
      if (values.length === 1) return values[0];
    }
    const stem = String(fileName).replace(/\.(?:xlsx|xls|csv)$/i, "").replace(/[-_]?\d{8}$/, "").replace(/[-_]?\d{4}[-_.]\d{2}[-_.]\d{2}$/, "").replace(/[-_]?product_list$/i, "").trim();
    return stem;
  }

  function headerIndex(headers, names) {
    const candidates = Array.isArray(names) ? names : [names];
    for (const name of candidates) {
      const index = resolveHeaderIndex(headers, name);
      if (index >= 0) return index;
    }
    return undefined;
  }

  function headerOccurrenceIndex(headers, name, occurrence = 0) {
    return resolveHeaderIndex(headers, name, occurrence);
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
    const isCsv = /\.csv$/i.test(file.name);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const workbook = isCsv
            ? xlsxApi.read(reader.result, { type: "string" })
            : xlsxApi.read(reader.result, { type: "array", cellText: true, cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = xlsxApi.utils.sheet_to_json(firstSheet, { header: 1, defval: null, raw: false });
          const headerRowIndex = rows.findIndex((row) => {
            const cells = row.map((cell) => String(cell ?? "").trim());
            return resolveHeaderIndex(cells, "商品 ID") >= 0 && resolveHeaderIndex(cells, "商品名") >= 0;
          });
          if (headerRowIndex < 0) throw new Error("未找到“商品名 / 商品 ID”表头；若列名是特殊写法，请先在数据接入页做一次字段指认，系统会记住");
          const headers = rows[headerRowIndex].map((cell) => String(cell ?? "").trim());
          const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((cell) => cell != null && cell !== ""));
          const columns = {
            name: headerIndex(headers, "商品名"), id: headerIndex(headers, "商品 ID"), status: headerIndex(headers, "发品状态"),
            gmv: headerIndex(headers, "GMV"), orders: headerIndex(headers, "订单数"), skuOrders: headerIndex(headers, "SKU 订单数"),
            units: headerIndex(headers, "商品成交件数"), customers: headerIndex(headers, "预计客户数"), avgOrderValue: headerIndex(headers, "平均订单金额（SKU 订单）"),
            exposure: headerIndex(headers, "商品曝光次数"), clicks: headerIndex(headers, "商品点击量"), ctr: headerIndex(headers, "商品点击率"),
            addToCart: headerIndex(headers, "加购次数"), addToCartRate: headerIndex(headers, "加购率"), ctor: headerIndex(headers, "CTOR（SKU 订单）"),
            uniqueClickCvr: headerIndex(headers, "去重点击成交转化率（SKU 订单）"),
          };
          const cellAt = (row, index) => (index == null || index < 0 ? null : row[index]);
          const products = dataRows.map((row) => hydrateProductFromSource({
            id: cellAt(row, columns.id) == null ? "" : String(cellAt(row, columns.id)).trim(),
            name: cellAt(row, columns.name) == null ? "" : String(cellAt(row, columns.name)).trim(),
            status: cellAt(row, columns.status) == null ? "" : String(cellAt(row, columns.status)),
            gmv: parseNumber(cellAt(row, columns.gmv)), orders: parseNumber(cellAt(row, columns.orders)), skuOrders: parseNumber(cellAt(row, columns.skuOrders)),
            units: parseNumber(cellAt(row, columns.units)), customers: parseNumber(cellAt(row, columns.customers)), avgOrderValue: parseNumber(cellAt(row, columns.avgOrderValue)),
            exposure: parseNumber(cellAt(row, columns.exposure)), clicks: parseNumber(cellAt(row, columns.clicks)), ctr: parseNumber(cellAt(row, columns.ctr)),
            addToCart: parseNumber(cellAt(row, columns.addToCart)), addToCartRate: parseNumber(cellAt(row, columns.addToCartRate)), ctor: parseNumber(cellAt(row, columns.ctor)),
            uniqueClickCvr: parseNumber(cellAt(row, columns.uniqueClickCvr)),
            sourceValues: row.slice(0, headers.length),
          }, headers)).filter((product) => product.id && product.name);
          if (!products.length) throw new Error("文件中没有可识别的商品记录");
          resolve({
            reportDate: parseDateFromFilename(file.name) || inferDateFromSheet(headers, dataRows),
            inferredStore: inferStoreName(file.name, headers, dataRows),
            sourceFile: file.name,
            productCount: products.length,
            totals: summarizeProducts(products),
            sourceHeaders: headers,
            products,
            matchReport: buildHeaderMatchReport(headers),
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      if (isCsv) reader.readAsText(file, "UTF-8");
      else reader.readAsArrayBuffer(file);
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

  /* ========== 今日优先处理：商品 / 达人 / 广告 / 短视频 四版块 ========== */
  const PRIORITY_CATEGORIES = [
    { key: "product", icon: "🛍️", label: "商品" },
    { key: "creator", icon: "🤝", label: "达人" },
    { key: "ads", icon: "🎯", label: "广告" },
    { key: "video", icon: "🎬", label: "短视频" },
  ];
  let activePriorityCategory = "product";

  function changeLabel(value, digits = 1) {
    if (value == null) return "待导入";
    return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
  }

  function daysBetween(fromDate, toDate) {
    const from = new Date(`${fromDate}T00:00:00Z`);
    const to = new Date(`${toDate}T00:00:00Z`);
    const days = Math.round((to - from) / 86400000);
    return days > 0 ? days : 1;
  }

  // 商品优先处理：用相邻两个真实快照逐项对比，生成带完整说明的处理项
  function productPriorityData() {
    const items = [];
    let comparableStores = 0;
    storesInScope().forEach((store) => {
      const snapshots = snapshotsInRange(store);
      if (snapshots.length < 2) return;
      comparableStores += 1;
      const previous = snapshots[snapshots.length - 2];
      const current = snapshots[snapshots.length - 1];
      const intervalDays = daysBetween(previous.reportDate, current.reportDate);
      const intervalText = intervalDays === 1 ? "环比昨日" : `对比 ${previous.reportDate}（相隔 ${intervalDays} 天）`;
      const previousMap = new Map(previous.products.map((product) => [product.id, product]));
      current.products.forEach((product) => {
        const prev = previousMap.get(product.id);
        if (!prev) return;
        const exposureChg = product.exposure != null && prev.exposure ? (product.exposure - prev.exposure) / prev.exposure * 100 : null;
        const gmvChg = product.gmv != null && prev.gmv ? (product.gmv - prev.gmv) / prev.gmv * 100 : null;
        const ctrChgPp = product.ctr != null && prev.ctr != null ? product.ctr - prev.ctr : null;
        const cvrNow = product.ctor ?? product.uniqueClickCvr;
        const cvrPrev = prev.ctor ?? prev.uniqueClickCvr;
        const cvrChgPp = cvrNow != null && cvrPrev != null ? cvrNow - cvrPrev : null;
        const metricLines = [
          `曝光 ${formatCompact(prev.exposure)} → ${formatCompact(product.exposure)}（${changeLabel(exposureChg)}）`,
          `CTR ${formatPercent(prev.ctr)} → ${formatPercent(product.ctr)}（${ctrChgPp == null ? "待导入" : `${ctrChgPp > 0 ? "+" : ""}${ctrChgPp.toFixed(2)}pp`}）`,
          `CVR ${formatPercent(cvrPrev)} → ${formatPercent(cvrNow)}（${cvrChgPp == null ? "待导入" : `${cvrChgPp > 0 ? "+" : ""}${cvrChgPp.toFixed(2)}pp`}）`,
          `GMV ${formatMoney(prev.gmv)} → ${formatMoney(product.gmv)}（${changeLabel(gmvChg)}）`,
        ].join("；");
        const impactText = prev.gmv != null && product.gmv != null && prev.gmv > product.gmv
          ? `若趋势延续，每 ${intervalDays} 天影响 GMV 约 <b>${formatMoney(prev.gmv - product.gmv)}</b>。`
          : "";
        const header = `<b>${escapeHtml(store.name)}</b> · ${escapeHtml(product.name)} · 商品 ID <b>${escapeHtml(product.id)}</b> · ${intervalText}`;

        if (exposureChg != null && exposureChg <= -20) {
          const ctrStable = ctrChgPp != null && Math.abs(ctrChgPp) < 0.5;
          items.push({
            sev: "high", score: Math.abs(exposureChg) * 2,
            title: `❗ ${product.id} · 曝光大幅下降 ${Math.abs(exposureChg).toFixed(1)}%`,
            body: `${header}<br>【数据变化】${metricLines}。<br>【原因分析】${ctrStable ? "CTR 基本稳定而曝光骤降，初步判断是推荐流量入口变化或分发减少，<b>不是主图问题</b>；建议优先核查流量来源。" : "曝光与 CTR 同步下滑，疑似商品整体权重下降或触发风控限流，需同时排查流量入口与商品状态。"}<br>【建议动作】1) 检查商品是否仍在推荐池 / 是否掉出搜索排名；2) 核对是否有违规、下架、类目调整记录；3) 用广告或短视频补量验证承接是否正常。${impactText ? `<br>【预估影响】${impactText}` : ""}`,
            tags: ["高优先级", `基线 ${previous.reportDate}`],
          });
        } else if (exposureChg != null && exposureChg <= -8) {
          items.push({
            sev: "medium", score: Math.abs(exposureChg),
            title: `📉 ${product.id} · 曝光下降 ${Math.abs(exposureChg).toFixed(1)}%`,
            body: `${header}<br>【数据变化】${metricLines}。<br>【原因分析】曝光降幅未达高风险线（20%），${cvrChgPp != null && cvrChgPp > 0 ? "且 CVR 逆势上涨，转化效率改善正在对冲曝光损失。" : "需观察是否为短期波动。"}<br>【建议动作】先观察 T+1 数据，暂不调整主图与价格；若连续两期下降再介入。`,
            tags: ["中优先级", "观察"],
          });
        }
        if (gmvChg != null && gmvChg <= -15) {
          const driver = exposureChg != null && exposureChg <= -15 ? "主要由曝光下滑驱动，先解决流量问题。"
            : (cvrChgPp != null && cvrChgPp <= -0.3 ? "曝光基本稳定但 CVR 下滑，问题在转化承接：重点核查价格、评价与详情页。" : "多指标联动变化，建议逐层排查流量与转化。");
          items.push({
            sev: "high", score: Math.abs(gmvChg) * 1.5,
            title: `💰 ${product.id} · GMV 下降 ${Math.abs(gmvChg).toFixed(1)}%`,
            body: `${header}<br>【数据变化】${metricLines}。<br>【原因分析】${driver}<br>【建议动作】1) 按上述方向定位主因；2) 恢复动作执行后记录到"运营调整记录"，T+1/T+3 自动验证效果。${impactText ? `<br>【预估影响】${impactText}` : ""}`,
            tags: ["高优先级", `基线 ${previous.reportDate}`],
          });
        }
        if (ctrChgPp != null && ctrChgPp <= -0.5 && (exposureChg == null || exposureChg > -20)) {
          items.push({
            sev: "medium", score: Math.abs(ctrChgPp),
            title: `👆 ${product.id} · CTR 下降 ${Math.abs(ctrChgPp).toFixed(2)}pp`,
            body: `${header}<br>【数据变化】${metricLines}。<br>【原因分析】曝光基本稳定但点击率下降，通常是主图 / 标题 / 价格展示吸引力下降，或同质竞品分流。<br>【建议动作】对比竞品前排链接的主图与价格带；可小步测试替换首图，改动后记录动作等 T+3 验证。`,
            tags: ["中优先级", "主图/标题"],
          });
        }
        if (cvrChgPp != null && cvrChgPp <= -0.3 && (gmvChg == null || gmvChg > -15)) {
          items.push({
            sev: "medium", score: Math.abs(cvrChgPp),
            title: `🛒 ${product.id} · CVR 下降 ${Math.abs(cvrChgPp).toFixed(2)}pp`,
            body: `${header}<br>【数据变化】${metricLines}。<br>【原因分析】点击后的成交转化走弱，优先核查：价格变动、差评增加、详情页信息缺失、运费/优惠变化。<br>【建议动作】核对近期待价格与评价；如是价格测试导致，回滚或调整组合装策略。`,
            tags: ["中优先级", "转化承接"],
          });
        }
        if (gmvChg != null && gmvChg >= 15) {
          items.push({
            sev: "good", score: gmvChg,
            title: `↗ ${product.id} · GMV 上涨 ${gmvChg.toFixed(1)}%（标杆）`,
            body: `${header}<br>【数据变化】${metricLines}。<br>【动作建议】追溯近期对该链接做过的动作（主图 / 价格 / 标题 / 投放），如已记录则等 T+3/T+7 验证后沉淀到知识库，供同类商品复用。`,
            tags: ["标杆", "可沉淀"],
          });
        }
      });
    });
    if (!comparableStores) {
      return {
        items: [],
        emptyHtml: `当前每个店铺只有 <b>1 个日期快照</b>，无法计算变化。每天导入一次店铺导出表后，这里会自动生成商品级优先处理清单（曝光 / GMV / CTR / CVR 异常 + 原因分析 + 建议动作 + 预估影响）。<br>缺数据不做假：这是本中控台的硬规则。`,
      };
    }
    const severityOrder = { high: 0, medium: 1, low: 2, good: 3 };
    items.sort((left, right) => severityOrder[left.sev] - severityOrder[right.sev] || right.score - left.score);
    return { items: items.slice(0, 8) };
  }

  function priorityCategoryData(key) {
    if (key === "product") return productPriorityData();
    const providers = window.OPS_EXT_PRIORITY_PROVIDERS || {};
    const provider = providers[key];
    if (typeof provider === "function") {
      try {
        return provider();
      } catch (error) {
        console.warn("priority provider failed:", key, error);
      }
    }
    return { items: [], emptyHtml: "模块加载中…" };
  }

  function priorityDetailHtml(data) {
    if (!data || !Array.isArray(data.items)) return `<div class="ops-empty">模块加载中…</div>`;
    if (!data.items.length) return `<div class="ops-empty">${data.emptyHtml || "当前没有待处理事项。"}</div>`;
    const tagClass = { high: "tag-red", medium: "tag-yellow", low: "tag-blue", good: "tag-green" };
    return data.items.map((item) => `<div class="priority-item sev-${item.sev}">
      <div class="priority-item-title">${item.title}</div>
      <div class="priority-item-body">${item.body}</div>
      <div class="priority-item-tags">${(item.tags || []).map((tag, index) => `<span class="tag ${index === 0 ? (tagClass[item.sev] || "tag-gray") : "tag-gray"}">${escapeHtml(tag)}</span>`).join("")}</div>
    </div>`).join("");
  }

  function renderPriorityPanel() {
    const hub = document.getElementById("priority-hub");
    if (!hub) return;
    const dataByCategory = Object.fromEntries(PRIORITY_CATEGORIES.map((category) => [category.key, priorityCategoryData(category.key)]));
    if (!dataByCategory[activePriorityCategory]) activePriorityCategory = "product";
    hub.innerHTML = `
      <div class="priority-hub-tabs">${PRIORITY_CATEGORIES.map((category) => {
        const data = dataByCategory[category.key];
        const count = data && Array.isArray(data.items) ? data.items.length : 0;
        const preview = count ? data.items[0].title.replace(/<[^>]*>/g, "") : "暂无待处理";
        return `<div class="priority-tab ${activePriorityCategory === category.key ? "active" : ""}" data-priority-cat="${category.key}" role="button" tabindex="0">
          <div class="priority-tab-head"><span>${category.icon}</span><span>${category.label}</span><span class="priority-tab-count ${count ? "" : "zero"}">${count}</span></div>
          <div class="priority-tab-desc">${escapeHtml(preview)}</div>
        </div>`;
      }).join("")}</div>
      <div id="priority-detail">${priorityDetailHtml(dataByCategory[activePriorityCategory])}</div>`;
    hub.querySelectorAll("[data-priority-cat]").forEach((tab) => {
      tab.addEventListener("click", () => {
        activePriorityCategory = tab.getAttribute("data-priority-cat");
        renderPriorityPanel();
      });
    });
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
    if (uploadDescription) uploadDescription.textContent = `支持多选 .xlsx / .xls / .csv；当前保存 ${currentData.stores.length} 个店铺、${currentData.stores.reduce((sum, store) => sum + store.snapshots.length, 0)} 个日期快照。列名差异自动识别，店铺和日期自动推断。`;
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

  function renderImportReports(importedSnapshots) {
    const container = document.getElementById("import-report-panel");
    if (!container) return;
    const rows = importedSnapshots.map((snapshot) => {
      const report = snapshot.matchReport || { matched: [], unmatched: [] };
      const unmatchedText = report.unmatched.length
        ? report.unmatched.slice(0, 8).map((item) => escapeHtml(item.raw)).join("、") + (report.unmatched.length > 8 ? ` 等 ${report.unmatched.length} 列` : "")
        : "无（全部识别）";
      return `<tr>
        <td>${escapeHtml(snapshot.sourceFile)}</td>
        <td>${escapeHtml(snapshot.inferredStore || parseStoreFromFilename(snapshot.sourceFile) || "—")}</td>
        <td>${escapeHtml(snapshot.reportDate)}</td>
        <td>${formatNumber(snapshot.productCount, 0)}</td>
        <td>${report.matched.length} 列</td>
        <td>${unmatchedText}</td>
      </tr>`;
    }).join("");
    container.innerHTML = `<div class="import-report">
      <div class="import-report-title">🧾 本次导入报告 · ${new Date().toLocaleString("zh-CN", { hour12: false })}</div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>文件</th><th>店铺</th><th>日期</th><th>商品行数</th><th>成功识别</th><th>未识别列（可在上方指认）</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div style="margin-top:8px;font-size:12px;color:#0369a1;">识别规则：标准列名 → 规范化匹配 → 你指认过的记忆 → 同义词库。未识别的列不会影响其他数据，只是暂时不用；指认一次后永久生效。</div>
    </div>`;
  }

  function renderMappingPanel(importedSnapshots) {
    const container = document.getElementById("import-mapping-panel");
    if (!container) return;
    const unmatchedMap = new Map();
    importedSnapshots.forEach((snapshot) => {
      ((snapshot.matchReport && snapshot.matchReport.unmatched) || []).forEach((item) => {
        if (!unmatchedMap.has(item.raw)) unmatchedMap.set(item.raw, []);
        unmatchedMap.get(item.raw).push(snapshot.sourceFile);
      });
    });
    if (!unmatchedMap.size) {
      container.innerHTML = "";
      return;
    }
    const canonicalOptions = [...new Set(standardCanonicalHeaders())];
    const rows = [...unmatchedMap.entries()].map(([raw, files], index) => `<tr>
      <td><strong>${escapeHtml(raw)}</strong><div style="font-size:11px;color:#a16207;">来自：${escapeHtml(files.join("、"))}</div></td>
      <td><select data-mapping-raw="${escapeHtml(raw)}" class="mapping-select">
        <option value="">暂不处理（保持未识别）</option>
        <option value="__ignore__">忽略此列（以后不再提示）</option>
        ${canonicalOptions.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
      </select></td>
    </tr>`).join("");
    container.innerHTML = `<div class="mapping-panel">
      <div class="mapping-panel-title">🧭 有 ${unmatchedMap.size} 列没有自动识别 —— 指认一次，系统永久记住</div>
      <div style="font-size:12px;color:#92400e;margin-bottom:8px;">左边是文件里的原始列名，右边选择它对应的标准字段。不认识的列选"忽略此列"即可，不影响其他数据。</div>
      <div style="overflow-x:auto;"><table class="desktop-table" style="background:#fff;">
        <thead><tr><th style="width:45%;">原始列名</th><th>对应标准字段</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button type="button" class="btn btn-primary" id="apply-header-mapping">应用映射并重新计算</button>
        <button type="button" class="btn" id="dismiss-header-mapping">暂不处理</button>
      </div>
    </div>`;
    const applyButton = container.querySelector("#apply-header-mapping");
    const dismissButton = container.querySelector("#dismiss-header-mapping");
    if (dismissButton) dismissButton.addEventListener("click", () => { container.innerHTML = ""; });
    if (applyButton) applyButton.addEventListener("click", async () => {
      const selects = [...container.querySelectorAll("select[data-mapping-raw]")];
      let applied = 0;
      selects.forEach((select) => {
        if (!select.value) return;
        saveLearnedHeaderMapping(select.getAttribute("data-mapping-raw"), select.value);
        applied += 1;
      });
      if (applied) {
        currentData = normalizeData(currentData);
        try {
          await saveCurrentData();
        } catch (error) {
          window.alert(`❌ 映射已记住，但保存失败\n\n${error.message || ""}`);
        }
        renderAll();
      }
      container.innerHTML = "";
      updateUploadStatus(applied ? `已记住 ${applied} 条字段映射并重新计算` : "未选择映射");
    });
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
      for (const snapshot of importedSnapshots) {
        if (!isDateKey(snapshot.reportDate)) {
          const input = window.prompt(`未能自动识别文件「${snapshot.sourceFile}」的数据日期。\n\n请输入该文件对应的日期（格式 YYYY-MM-DD），点取消则中止本次导入：`, "");
          if (input && isDateKey(input.trim())) snapshot.reportDate = input.trim();
          else throw new Error(`${snapshot.sourceFile} 缺少可用日期，本次导入已取消`);
        }
        if (!snapshot.inferredStore) {
          const input = window.prompt(`未能自动识别文件「${snapshot.sourceFile}」的店铺名称。\n\n请输入店铺名，点取消则中止本次导入：`, "");
          if (input && input.trim()) snapshot.inferredStore = input.trim();
          else throw new Error(`${snapshot.sourceFile} 缺少店铺名称，本次导入已取消`);
        }
      }
      const storeMap = new Map(currentData.stores.map((store) => [store.name, normalizeStore(store)]));
      importedSnapshots.forEach((snapshot) => {
        const storeName = snapshot.inferredStore;
        const store = storeMap.get(storeName) || { name: storeName, snapshots: [] };
        store.snapshots = [...store.snapshots.filter((item) => item.reportDate !== snapshot.reportDate), snapshot]
          .sort((left, right) => left.reportDate.localeCompare(right.reportDate));
        storeMap.set(storeName, store);
      });
      currentData = { ...currentData, version: 2, importedAt: new Date().toISOString().slice(0, 10), stores: [...storeMap.values()] };
      await saveCurrentData();
      window.localStorage.setItem("tiktok-real-data-state-v4", "imported");
      window.dispatchEvent(new CustomEvent("real-data-imported"));
      selectedStore = "all";
      selectedDatePreset = "all";
      customStartDate = "";
      customEndDate = "";
      renderAll();
      renderImportReports(importedSnapshots);
      renderMappingPanel(importedSnapshots);
      const unmatchedCount = importedSnapshots.reduce((sum, snapshot) => sum + (((snapshot.matchReport || {}).unmatched || []).length), 0);
      updateUploadStatus(`已导入 ${importedSnapshots.length} 个文件 · ${importedSnapshots.reduce((sum, snapshot) => sum + snapshot.productCount, 0)} 条商品`);
      window.alert(`✅ 数据导入完成\n\n${importedSnapshots.map((snapshot) => `${snapshot.inferredStore} · ${snapshot.reportDate}：${snapshot.productCount} 条商品`).join("\n")}\n\n历史快照已按店铺和日期保存。${unmatchedCount ? `\n\n有 ${unmatchedCount} 列未自动识别，请到「数据接入」页的黄色面板指认一次，系统会永久记住。` : "\n\n所有列均已自动识别。"}`);
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
      window.localStorage.setItem("tiktok-real-data-state-v4", "cleared");
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
    if (window.OPS_EXT && typeof window.OPS_EXT.render === "function") {
      try {
        window.OPS_EXT.render();
      } catch (error) {
        console.warn("OPS_EXT render failed", error);
      }
    }
  }

  // 供 ops-extensions.js 使用的数据与工具桥
  window.OPS_BRIDGE = {
    getData: () => currentData,
    normalizeData,
    setData: (data) => { currentData = data; },
    saveCurrentData,
    ensureXlsxLibrary,
    productsInScope,
    storesInScope,
    snapshotsInRange,
    totalsInScope,
    availableDateKeys,
    dateBounds,
    selectedDateBounds,
    hydrateProductFromSource,
    summarizeProducts,
    formatMoney,
    formatNumber,
    formatPercent,
    formatCompact,
    escapeHtml,
    isDateKey,
    addDays,
    parseNumber,
    parseDateCell,
    normalizeHeaderText,
    resolveHeaderIndex,
    resolveHeaderIndices,
    standardCanonicalHeaders,
    renderAll,
    renderPriorityPanel,
    updateUploadStatus,
  };

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
      window.dispatchEvent(new CustomEvent("real-store-ready"));
    })
    .catch((error) => {
      console.warn("Unable to restore local store data", error);
      updateUploadStatus("公开快照已加载；本地历史读取失败", "error");
    });
})();
