/* TikTok Shop 导出文件归类：只保存文件元数据；原始文件仍由用户掌控。 */
(function () {
  "use strict";

  const CATEGORIES = ["广告", "商品", "达人视频", "达人", "样品订单", "联盟订单"];
  const KNOWN_STORES = ["INSPIRE PURIFY", "Miniyaya", "PETTOS", "yaya thailand tth", "yaya112"];
  const CATALOG_KEY = "tiktok-data-file-catalog-v1";
  const DIRECTORY_DB = "tiktok-ai-operations-center";
  const DIRECTORY_STORE = "datasets";
  const DIRECTORY_KEY = "file-categorization-directory-v1";
  let directoryHandle = null;
  let catalog = loadCatalog();

  function normalize(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s_\-./\\:：]+/g, "");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char]));
  }

  function dateFromFilename(fileName) {
    const text = String(fileName || "");
    let match = text.match(/(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})/);
    if (!match) match = text.match(/(20\d{2})(\d{2})(\d{2})/);
    return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : "待确认";
  }

  function categoryFromPath(relativePath) {
    const parts = String(relativePath || "").split(/[\\/]/).map(normalize);
    return CATEGORIES.find((category) => parts.includes(normalize(category))) || "";
  }

  function categoryFromFilename(fileName) {
    const name = String(fileName || "");
    const hints = [
      [/creative\s*data|campaign|广告/i, "广告"],
      [/product[_\s-]*list|商品/i, "商品"],
      [/video[_\s-]*analysis|video[_\s-]*list|达人视频/i, "达人视频"],
      [/creator[_\s-]*list|达人/i, "达人"],
      [/affiliate[_\s-]*orders|联盟订单/i, "联盟订单"],
      [/全部.*订单|sample|样品/i, "样品订单"],
    ];
    return hints.find(([pattern]) => pattern.test(name))?.[1] || "";
  }

  function storeFromPath(relativePath) {
    const parts = String(relativePath || "").split(/[\\/]/).filter(Boolean);
    return KNOWN_STORES.find((store) => parts.some((part) => normalize(part) === normalize(store))) || "";
  }

  function storeFromFilename(fileName) {
    const normalizedName = normalize(fileName);
    return KNOWN_STORES.find((store) => normalizedName.includes(normalize(store))) || "";
  }

  const HEADER_SIGNATURES = [
    { category: "商品", keywords: ["商品id", "商品名"] },
    { category: "广告", keywords: ["广告计划名称", "campaignid", "creativetype", "成本"] },
    { category: "达人视频", keywords: ["视频id", "视频标题", "联盟视频归因gmv"] },
    { category: "达人", keywords: ["达人用户名", "联盟gmv", "商品曝光次数"] },
    { category: "样品订单", keywords: ["orderid", "skuid", "sellersku"] },
    { category: "联盟订单", keywords: ["订单id", "商品id", "达人用户名"] },
  ];

  function categoryFromRows(rows) {
    const matches = HEADER_SIGNATURES.map((signature) => {
      const score = rows.slice(0, 6).reduce((best, row) => {
        const cells = (row || []).map(normalize);
        const current = signature.keywords.reduce((sum, keyword) => sum + (cells.some((cell) => cell === normalize(keyword) || cell.includes(normalize(keyword))) ? 1 : 0), 0);
        return Math.max(best, current);
      }, 0);
      return { category: signature.category, score };
    }).filter((match) => match.score >= 2).sort((left, right) => right.score - left.score);
    return matches.length && (matches.length === 1 || matches[0].score > matches[1].score) ? matches[0].category : "";
  }

  async function readRows(file) {
    if (!window.XLSX || typeof file.arrayBuffer !== "function") return [];
    const isCsv = /\.csv$/i.test(file.name);
    const source = isCsv ? await file.text() : await file.arrayBuffer();
    const workbook = window.XLSX.read(source, isCsv ? { type: "string" } : { type: "array", cellText: true, cellDates: false });
    const firstSheet = workbook.SheetNames[0];
    return firstSheet ? window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: null, raw: false }) : [];
  }

  function findHeaderIndex(rows) {
    return rows.findIndex((row) => {
      const cells = (row || []).map(normalize);
      return HEADER_SIGNATURES.some((signature) => signature.keywords.filter((keyword) => cells.some((cell) => cell === normalize(keyword) || cell.includes(normalize(keyword)))).length >= 2);
    });
  }

  async function classifyFile(file) {
    const relativePath = file.webkitRelativePath || "";
    let category = categoryFromPath(relativePath) || categoryFromFilename(file.name);
    let rowCount = null;
    try {
      const rows = await readRows(file);
      if (!category) category = categoryFromRows(rows);
      const headerIndex = findHeaderIndex(rows);
      if (headerIndex >= 0) rowCount = Math.max(rows.length - headerIndex - 1, 0);
    } catch (error) {
      console.warn(`读取归类信息失败：${file.name}`, error);
    }
    return {
      storeName: storeFromPath(relativePath) || storeFromFilename(file.name) || "待确认",
      category: category || "待确认",
      reportDate: dateFromFilename(file.name),
      sourceFile: file.name,
      relativePath,
      rowCount,
      importedAt: new Date().toISOString(),
      localPath: "仅浏览器保存",
    };
  }

  function loadCatalog() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CATALOG_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function saveCatalog() {
    window.localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
  }

  function catalogKey(record) {
    return [record.storeName, record.category, record.sourceFile, record.relativePath].join("|");
  }

  function mergeCatalog(records) {
    const incoming = new Map(records.map((record) => [catalogKey(record), record]));
    catalog = catalog.filter((record) => !incoming.has(catalogKey(record)));
    catalog = [...incoming.values(), ...catalog].sort((left, right) => right.importedAt.localeCompare(left.importedAt));
    saveCatalog();
  }

  function openDirectoryDatabase() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DIRECTORY_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DIRECTORY_STORE)) request.result.createObjectStore(DIRECTORY_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("无法打开本地目录设置"));
    });
  }

  async function saveDirectoryHandle(handle) {
    const db = await openDirectoryDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(DIRECTORY_STORE, "readwrite");
      transaction.objectStore(DIRECTORY_STORE).put(handle, DIRECTORY_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("无法保存本地目录设置"));
    });
  }

  async function loadDirectoryHandle() {
    if (!window.indexedDB) return;
    try {
      const db = await openDirectoryDatabase();
      directoryHandle = await new Promise((resolve, reject) => {
        const request = db.transaction(DIRECTORY_STORE, "readonly").objectStore(DIRECTORY_STORE).get(DIRECTORY_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      renderCatalog();
    } catch (error) {
      console.warn("读取本地归类目录失败", error);
    }
  }

  async function chooseLocalDirectory() {
    if (typeof window.showDirectoryPicker !== "function") {
      window.alert("当前浏览器不支持直接写入本地文件夹，请使用最新版 Chrome 或 Edge。");
      return;
    }
    try {
      directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveDirectoryHandle(directoryHandle);
      renderCatalog();
      window.alert(`已连接本地归类目录：${directoryHandle.name}\n\n后续导入文件时会自动复制到“店铺\\数据类型”目录。`);
    } catch (error) {
      if (error?.name !== "AbortError") window.alert(`❌ 无法选择本地归类目录\n\n${error.message || "浏览器拒绝了目录访问"}`);
    }
  }

  async function copyFile(file, record) {
    if (!directoryHandle || record.storeName === "待确认" || record.category === "待确认") return record.localPath;
    const permission = await directoryHandle.queryPermission({ mode: "readwrite" });
    const granted = permission === "granted" || await directoryHandle.requestPermission({ mode: "readwrite" }) === "granted";
    if (!granted) return "未获得本地目录写入权限";
    const storeDirectory = await directoryHandle.getDirectoryHandle(record.storeName, { create: true });
    const categoryDirectory = await storeDirectory.getDirectoryHandle(record.category, { create: true });
    const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const baseName = extension ? file.name.slice(0, -extension.length) : file.name;
    let targetName = file.name;
    let suffix = 1;
    while (true) {
      try {
        await categoryDirectory.getFileHandle(targetName);
        targetName = `${baseName} (${suffix++})${extension}`;
      } catch (error) {
        if (error?.name !== "NotFoundError") throw error;
        break;
      }
    }
    const target = await categoryDirectory.getFileHandle(targetName, { create: true });
    const writable = await target.createWritable();
    await writable.write(file);
    await writable.close();
    return `${record.storeName}/${record.category}/${targetName}`;
  }

  function setDirectoryStatus(text, className) {
    const element = document.getElementById("local-directory-status");
    if (!element) return;
    element.textContent = text;
    element.className = `tag ${className || "tag-gray"}`;
  }

  function renderCatalog() {
    const container = document.getElementById("data-file-catalog");
    if (!container) return;
    setDirectoryStatus(directoryHandle ? `已连接：${directoryHandle.name}` : "未选择本地目录，仅保存到当前浏览器", directoryHandle ? "tag-green" : "tag-gray");
    if (!catalog.length) {
      container.innerHTML = '<div class="real-ranking-empty">还没有导入分类文件。选择一批 TikTok Shop 导出文件后，网站会按店铺、数据类型和文件日期自动登记。</div>';
      return;
    }
    const stores = [...new Set([...KNOWN_STORES, ...catalog.map((record) => record.storeName)])];
    const cells = (store, category) => catalog.filter((record) => record.storeName === store && record.category === category).length;
    const rows = stores.map((store) => `<tr><td>${escapeHtml(store)}</td>${CATEGORIES.map((category) => `<td>${cells(store, category) || "—"}</td>`).join("")}<td><strong>${catalog.filter((record) => record.storeName === store).length}</strong></td></tr>`).join("");
    const recent = catalog.slice(0, 12).map((record) => `<tr><td>${escapeHtml(record.storeName)}</td><td><span class="tag tag-blue">${escapeHtml(record.category)}</span></td><td>${escapeHtml(record.reportDate)}</td><td>${escapeHtml(record.sourceFile)}</td><td>${record.rowCount == null ? "—" : record.rowCount}</td><td>${escapeHtml(record.localPath)}</td></tr>`).join("");
    const unresolved = catalog.filter((record) => record.storeName === "待确认" || record.category === "待确认").length;
    container.innerHTML = `<div class="file-catalog-summary">已登记 ${catalog.length} 个文件 · ${unresolved ? `${unresolved} 个待确认` : "店铺和数据类型均已识别"}</div><div class="desktop-table-wrap"><table class="desktop-table file-catalog-table"><thead><tr><th>店铺</th>${CATEGORIES.map((category) => `<th>${category}</th>`).join("")}<th>合计</th></tr></thead><tbody>${rows}</tbody></table></div><div class="desktop-table-wrap file-catalog-table"><table class="desktop-table"><thead><tr><th>店铺</th><th>类型</th><th>数据日期</th><th>文件名</th><th>记录数</th><th>本地归类路径</th></tr></thead><tbody>${recent}</tbody></table></div>`;
  }

  async function ingestFiles(files) {
    const selectedFiles = [...(files || [])];
    if (!selectedFiles.length) return;
    setDirectoryStatus(`正在登记 ${selectedFiles.length} 个文件…`, "tag-yellow");
    const records = [];
    for (const file of selectedFiles) {
      const record = await classifyFile(file);
      try {
        record.localPath = await copyFile(file, record);
      } catch (error) {
        record.localPath = `写入失败：${error.message || "未知错误"}`;
      }
      records.push(record);
    }
    mergeCatalog(records);
    renderCatalog();
    window.dispatchEvent(new CustomEvent("file-catalog-updated", { detail: { records } }));
  }

  function downloadManifest() {
    const payload = { exportedAt: new Date().toISOString(), categories: CATEGORIES, files: catalog };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    link.download = "tiktok-data-auto-categorization-manifest.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  window.openUnifiedDirectoryPicker = function () {
    document.getElementById("unified-data-directory-input")?.click();
  };
  window.DATA_FILE_CATALOG = { get: () => [...catalog], categories: CATEGORIES };
  document.getElementById("choose-local-directory")?.addEventListener("click", chooseLocalDirectory);
  document.getElementById("download-catalog-manifest")?.addEventListener("click", downloadManifest);
  ["unified-data-file-input", "unified-data-directory-input"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", async (event) => {
      try { await ingestFiles(event.target.files); } finally { event.target.value = ""; }
    });
  });
  renderCatalog();
  loadDirectoryHandle();
})();
