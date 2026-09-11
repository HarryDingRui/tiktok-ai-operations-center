/*
 * Control Plane: 本地动作验证、知识库和 Agent 任务闭环。
 * GitHub Pages 没有后端，因此这里执行可审计的浏览器本地规则；不会伪装成外部模型或私有 API。
 */
(function () {
  "use strict";

  const bridge = window.OPS_BRIDGE;
  if (!bridge) return;

  const ACTIONS_KEY = "ops-control-plane-actions-v1";
  const KNOWLEDGE_KEY = "ops-control-plane-knowledge-v1";
  const TASKS_KEY = "ops-control-plane-agent-tasks-v1";
  const MAX_TASKS = 100;
  const esc = bridge.escapeHtml || ((value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (error) { return fallback; }
  }
  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  function text(value) { return value == null ? "" : String(value).trim(); }
  function number(value) {
    if (value == null || value === "") return null;
    const parsed = Number(String(value).replace(/[฿$¥,%\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function date(value) {
    const raw = text(value);
    if (/^20\d{2}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : "";
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function normalizedHeader(value) { return bridge.normalizeHeaderText ? bridge.normalizeHeaderText(text(value)) : text(value).toLowerCase().replace(/\s+/g, ""); }
  function findHeader(headers, aliases) {
    const normalized = headers.map(normalizedHeader);
    for (const alias of aliases) {
      const wanted = normalizedHeader(alias);
      const exact = normalized.indexOf(wanted);
      if (exact >= 0) return exact;
    }
    for (const alias of aliases) {
      const wanted = normalizedHeader(alias);
      const partial = normalized.findIndex((item) => item && (item.includes(wanted) || wanted.includes(item)));
      if (partial >= 0) return partial;
    }
    return -1;
  }
  function headerRow(rows, aliases) {
    let best = { index: -1, score: 0 };
    rows.slice(0, 8).forEach((row, index) => {
      const score = aliases.reduce((total, alias) => total + (row.some((cell) => normalizedHeader(cell).includes(normalizedHeader(alias))) ? 1 : 0), 0);
      if (score > best.score) best = { index, score };
    });
    return best.score >= 1 ? best.index : -1;
  }
  function valueAt(row, headers, aliases) {
    const index = findHeader(headers, aliases);
    return index >= 0 ? row[index] : "";
  }
  function stableId(prefix, values) {
    return `${prefix}-${values.map((item) => normalizedHeader(item)).join("|")}`;
  }
  function inputScope() {
    return window.OPS_V33?.getScope ? window.OPS_V33.getScope() : { store: "all", bounds: null };
  }
  function inScope(record) {
    const scope = inputScope();
    if (scope.store && scope.store !== "all" && record.store !== scope.store) return false;
    const bounds = scope.bounds;
    return !bounds || !record.date || ((!bounds.start || record.date >= bounds.start) && (!bounds.end || record.date <= bounds.end));
  }
  function getRows(key) { return window.OPS_V33?.getRows ? window.OPS_V33.getRows(key) : []; }
  function storeFromFileName(fileName) {
    const normalized = normalizedHeader(fileName);
    return ["INSPIRE PURIFY", "Miniyaya", "PETTOS", "yaya thailand tth", "yaya112"].find((store) => normalized.includes(normalizedHeader(store))) || "";
  }

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
    const workbook = isCsv ? window.XLSX.read(buffer, { type: "string" }) : window.XLSX.read(buffer, { type: "array", cellText: true, cellDates: false });
    return workbook.SheetNames.flatMap((sheetName) => {
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });
      return [{ sheetName, rows }];
    });
  }
  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file, "UTF-8");
    });
  }

  const ACTION_ALIASES = {
    date: ["日期", "动作日期", "执行日期", "date"], store: ["店铺", "店铺名称", "store"], productId: ["商品ID", "Product ID", "商品 id", "productId"],
    dimension: ["维度", "模块", "dimension"], actionType: ["动作类型", "动作", "actionType", "type"], detail: ["动作说明", "动作内容", "说明", "detail", "备注"], owner: ["负责人", "owner"],
    verificationNode: ["验证节点", "验证周期", "节点", "verificationNode"], metric: ["指标", "metric"], expectedDirection: ["预期方向", "方向", "expectedDirection"], threshold: ["成功阈值", "阈值", "threshold"],
    result: ["验证结果", "结果", "result"], evidence: ["证据", "效果数据", "evidence"], evidenceDate: ["证据日期", "验证日期", "evidenceDate"], evidenceValue: ["证据值", "验证值", "evidenceValue"],
  };
  function parseActionsFromRows(rows, fileName) {
    const actions = [], errors = [];
    rows.forEach(({ sheetName, rows: sheetRows }) => {
      const start = headerRow(sheetRows, Object.values(ACTION_ALIASES).flat());
      if (start < 0) return;
      const headers = sheetRows[start] || [];
      sheetRows.slice(start + 1).forEach((row, index) => {
        if (!row.some((cell) => text(cell))) return;
        const record = { source: fileName, sheetName, importedAt: new Date().toISOString() };
        Object.keys(ACTION_ALIASES).forEach((key) => { record[key] = text(valueAt(row, headers, ACTION_ALIASES[key])); });
        record.date = date(record.date);
        if (!record.store) record.store = storeFromFileName(fileName);
        record.threshold = number(record.threshold);
        record.evidenceValue = number(record.evidenceValue);
        record.id = stableId("action", [record.date, record.store, record.productId, record.actionType, record.detail, index]);
        if (!record.date || (!record.actionType && !record.detail)) errors.push(`${sheetName} 第 ${index + start + 2} 行缺少日期或动作说明`);
        else actions.push(record);
      });
    });
    return { actions, errors };
  }
  function normalizeManualAction(record) {
    if (!record || !/运营调整|动作/.test(text(record.type))) return null;
    return {
      id: stableId("manual-action", [record.savedAt, record.date, record.name, record.detail]), source: "浏览器手动记录", date: date(record.date), store: text(record.store),
      productId: text(record.productId), dimension: "手动记录", actionType: text(record.name), detail: text(record.detail), owner: text(record.owner), verificationNode: "T+1/T+3/T+7",
      metric: text(record.metric), expectedDirection: text(record.expectedDirection), threshold: number(record.threshold), result: text(record.result), evidence: "", evidenceDate: "", evidenceValue: null, importedAt: record.savedAt || "",
    };
  }
  function getActions() {
    const imported = readJson(ACTIONS_KEY, []);
    const manual = readJson("tiktok-manual-entry-records", []).map(normalizeManualAction).filter(Boolean);
    return [...imported, ...manual].filter((record) => record.date && inScope(record));
  }
  async function importActions(file) {
    const result = parseActionsFromRows(await readWorkbook(file), file.name);
    const merged = new Map(readJson(ACTIONS_KEY, []).map((record) => [record.id, record]));
    result.actions.forEach((record) => merged.set(record.id, record));
    writeJson(ACTIONS_KEY, [...merged.values()]);
    return result;
  }

  const KNOWLEDGE_ALIASES = {
    title: ["标题", "知识标题", "title"], store: ["店铺", "店铺名称", "store"], productId: ["商品ID", "Product ID", "productId"], category: ["类目", "分类", "category"], actionType: ["动作类型", "动作", "actionType"],
    verificationNode: ["验证节点", "验证周期", "node"], period: ["时间段", "周期", "period"], owner: ["负责人", "owner"], description: ["描述", "方法论", "问题与方法", "description"],
    effect: ["效果", "效果数据", "effect"], status: ["状态", "status"], source: ["来源", "source"], tags: ["标签", "tags"],
  };
  function parseKnowledgeFromRows(rows, fileName) {
    const knowledge = [], errors = [];
    rows.forEach(({ sheetName, rows: sheetRows }) => {
      const start = headerRow(sheetRows, Object.values(KNOWLEDGE_ALIASES).flat());
      if (start < 0) return;
      const headers = sheetRows[start] || [];
      sheetRows.slice(start + 1).forEach((row, index) => {
        if (!row.some((cell) => text(cell))) return;
        const record = { source: fileName, sheetName, status: "pending", importedAt: new Date().toISOString() };
        Object.keys(KNOWLEDGE_ALIASES).forEach((key) => { record[key] = text(valueAt(row, headers, KNOWLEDGE_ALIASES[key])); });
        if (!record.store) record.store = storeFromFileName(fileName);
        record.status = /已审|approved/i.test(record.status) ? "approved" : "pending";
        record.id = stableId("knowledge", [record.title, record.productId, record.description, index]);
        if (!record.title || !record.description) errors.push(`${sheetName} 第 ${index + start + 2} 行缺少标题或描述`);
        else knowledge.push(record);
      });
    });
    return { knowledge, errors };
  }
  function normalizeManualKnowledge(record) {
    if (!record || !/运营知识库/.test(text(record.type))) return null;
    return { id: stableId("manual-knowledge", [record.savedAt, record.name, record.detail]), title: text(record.name), store: text(record.store), productId: text(record.productId), category: "手动记录", actionType: "", verificationNode: "", period: date(record.date), owner: text(record.owner), description: text(record.detail), effect: text(record.value), status: "pending", source: "浏览器手动记录", tags: "", importedAt: record.savedAt || "" };
  }
  function getKnowledge() {
    const imported = readJson(KNOWLEDGE_KEY, []);
    const manual = readJson("tiktok-manual-entry-records", []).map(normalizeManualKnowledge).filter(Boolean);
    return [...imported, ...manual].filter((record) => inScope({ ...record, date: record.period }));
  }
  async function importKnowledge(file) {
    let result;
    if (/\.(md|txt)$/i.test(file.name)) {
      const body = text(await readTextFile(file));
      result = { knowledge: body ? [{ id: stableId("knowledge", [file.name, body]), title: file.name.replace(/\.[^.]+$/, ""), store: storeFromFileName(file.name), description: body, status: "pending", source: file.name, importedAt: new Date().toISOString() }] : [], errors: body ? [] : ["文本文件为空"] };
    } else result = parseKnowledgeFromRows(await readWorkbook(file), file.name);
    const merged = new Map(readJson(KNOWLEDGE_KEY, []).map((record) => [record.id, record]));
    result.knowledge.forEach((record) => merged.set(record.id, record));
    writeJson(KNOWLEDGE_KEY, [...merged.values()]);
    return result;
  }

  function productSnapshot(productId, storeName, targetDate) {
    const data = bridge.getData ? bridge.getData() : null;
    const candidates = (data?.stores || []).filter((store) => !storeName || store.name === storeName || store.storeName === storeName || store.id === storeName);
    const matches = [];
    candidates.forEach((store) => (store.snapshots || []).forEach((snapshot) => {
      if (snapshot.reportDate !== targetDate) return;
      const product = (snapshot.products || []).find((item) => String(item.id) === String(productId));
      if (product) matches.push({ store, snapshot, product });
    }));
    return matches.length === 1 ? matches[0] : matches.length > 1 ? { ambiguous: true } : null;
  }
  function metricValue(product, metric) {
    const key = normalizedHeader(metric);
    const aliases = key.includes("gmv") || key.includes("成交") || key.includes("销售额") ? ["gmv", "revenue", "sales"] : key.includes("订单") || key.includes("销量") ? ["orders", "orderCount", "units"] : key.includes("曝光") || key.includes("view") ? ["exposure", "views"] : key.includes("点击") ? ["clicks"] : key.includes("粉丝") ? ["followers"] : [metric, key];
    for (const alias of aliases) if (product && product[alias] != null && number(product[alias]) != null) return number(product[alias]);
    return null;
  }
  function verificationNodes(record) {
    const matches = text(record.verificationNode).match(/T\s*\+\s*(1|3|7)/gi) || [];
    return matches.length ? [...new Set(matches.map((item) => Number(item.replace(/[^0-9]/g, ""))))] : [1, 3, 7];
  }
  function evaluateAction(action) {
    const nodes = verificationNodes(action);
    const baseline = productSnapshot(action.productId, action.store, action.date);
    const metric = action.metric || "GMV";
    const checks = nodes.map((node) => {
      const targetDate = bridge.addDays ? bridge.addDays(action.date, node) : "";
      const observed = productSnapshot(action.productId, action.store, targetDate);
      const baseValue = baseline && !baseline.ambiguous ? metricValue(baseline.product, metric) : null;
      const observedValue = observed && !observed.ambiguous ? metricValue(observed.product, metric) : null;
      const changePct = baseValue != null && baseValue !== 0 && observedValue != null ? (observedValue - baseValue) / Math.abs(baseValue) * 100 : null;
      let status = "待观察";
      if (baseline?.ambiguous || observed?.ambiguous) status = "无法判定";
      else if (baseValue != null && observedValue != null) status = "已观测";
      const explicitEvidence = node === Number(text(action.evidenceDate).match(/T\s*\+\s*(\d+)/i)?.[1]) || Boolean(action.evidence);
      const threshold = action.threshold;
      const direction = /下降|降低|减少|decrease|down/i.test(action.expectedDirection) ? "down" : "up";
      let verdict = "待验证";
      if (explicitEvidence && text(action.result) && /有效|成功|valid|success/i.test(action.result)) verdict = "有效";
      else if (explicitEvidence && text(action.result) && /无效|失败|invalid|fail/i.test(action.result)) verdict = "无效";
      else if (changePct != null && threshold != null) verdict = direction === "up" ? (changePct >= threshold ? "有效" : "无效") : (changePct <= -Math.abs(threshold) ? "有效" : "无效");
      return { node, targetDate, status, verdict, baseValue, observedValue, changePct, metric };
    });
    const concluded = checks.filter((check) => check.verdict !== "待验证");
    return { action, checks, verdict: concluded.length ? (concluded.some((check) => check.verdict === "有效") ? "有效" : "无效") : "待验证" };
  }

  function replacePage(pageId, html) {
    const page = document.getElementById(`page-${pageId}`);
    if (!page) return null;
    const header = page.querySelector(".page-header");
    if (!header) return null;
    const subtitles = {
      validation: "动作记录真实导入 · 依据 T+1 / T+3 / T+7 快照判定",
      knowledge: "本机真实知识记录 · 导入、审核与复用状态",
      agents: "本地规则引擎 · 读取当前数据范围并保存可追溯任务历史",
    };
    const subtitle = header.querySelector(".page-subtitle");
    if (subtitle && subtitles[pageId]) subtitle.textContent = subtitles[pageId];
    [...page.children].filter((child) => child !== header).forEach((child) => child.remove());
    const root = document.createElement("div");
    root.dataset.controlPlaneRoot = "true";
    root.innerHTML = html;
    page.appendChild(root);
    return root;
  }
  function notice(message, kind) { return `<div class="alert alert-${kind || "info"}" style="margin-bottom:14px;"><span>ℹ️</span><span>${esc(message)}</span></div>`; }
  function actionStatus(verdict) { return verdict === "有效" ? "tag-green" : verdict === "无效" ? "tag-red" : "tag-yellow"; }
  function renderValidation() {
    const actions = getActions().map(evaluateAction);
    const valid = actions.filter((item) => item.verdict === "有效").length;
    const invalid = actions.filter((item) => item.verdict === "无效").length;
    const pending = actions.length - valid - invalid;
    const cards = actions.length ? actions.map((item) => `<div class="card" style="margin-bottom:12px;border-left:4px solid ${item.verdict === "有效" ? "#10b981" : item.verdict === "无效" ? "#ef4444" : "#f59e0b"};"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><div><strong>${esc(item.action.date)} · ${esc(item.action.productId || "未填商品")}</strong><div style="font-size:13px;color:#475569;margin-top:3px;">${esc(item.action.actionType || item.action.detail)}</div></div><span class="tag ${actionStatus(item.verdict)}">${esc(item.verdict)}</span></div><div style="font-size:12px;color:#64748b;margin-top:8px;">负责人：${esc(item.action.owner || "未填写")} · 指标：${esc(item.action.metric || "GMV")} · 数据源：${esc(item.action.source || "本地记录")}</div><div class="desktop-table-wrap" style="margin-top:10px;"><table class="desktop-table"><thead><tr><th>节点</th><th>目标日期</th><th>基线</th><th>观测</th><th>变化</th><th>结论</th></tr></thead><tbody>${item.checks.map((check) => `<tr><td>T+${check.node}</td><td>${esc(check.targetDate || "—")}</td><td>${check.baseValue == null ? "待导入" : check.baseValue}</td><td>${check.observedValue == null ? "待导入" : check.observedValue}</td><td>${check.changePct == null ? "待导入" : `${check.changePct.toFixed(1)}%`}</td><td><span class="tag ${actionStatus(check.verdict)}">${esc(check.verdict)}</span></td></tr>`).join("")}</tbody></table></div>${item.verdict === "有效" ? `<button class="btn btn-primary cp-create-knowledge" data-action-id="${esc(item.action.id)}" style="margin-top:10px;">📚 沉淀到知识库</button>` : ""}</div>`).join("") : `<div class="card"><div class="ops-empty">暂无真实动作记录。请在「数据接入」上传动作 CSV，或通过手动添加录入日期、商品、动作和验证节点。</div></div>`;
    replacePage("validation", `${notice("当前结果只来自本地导入的动作记录与店铺快照；缺少 T+1/T+3/T+7 对应日期时保持“待验证”，不会用样例结论填充。") }<div class="stats-row"><div class="stat-card"><div class="stat-label">已验证有效</div><div class="stat-value" style="color:#10b981;">${valid}</div></div><div class="stat-card"><div class="stat-label">待验证</div><div class="stat-value" style="color:#f59e0b;">${pending}</div></div><div class="stat-card"><div class="stat-label">已证伪</div><div class="stat-value" style="color:#ef4444;">${invalid}</div></div><div class="stat-card"><div class="stat-label">动作记录</div><div class="stat-value">${actions.length}</div></div></div><div id="cp-validation-list">${cards}</div>`);
  }

  function knowledgeCard(record, allowApprove) { return `<div class="card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><strong>${esc(record.title)}</strong><span class="tag ${record.status === "approved" ? "tag-green" : "tag-yellow"}">${record.status === "approved" ? "对外已审" : "待审核"}</span></div><div style="font-size:13px;color:#334155;margin-top:8px;white-space:pre-wrap;">${esc(record.description)}</div><div style="font-size:12px;color:#64748b;margin-top:8px;">商品：${esc(record.productId || "未指定")} · 动作：${esc(record.actionType || "未指定")} · 来源：${esc(record.source || "本地记录")}</div>${allowApprove && record.status !== "approved" ? `<button class="btn btn-primary cp-approve-knowledge" data-knowledge-id="${esc(record.id)}" style="margin-top:10px;">审核入库</button>` : ""}</div>`; }
  function renderKnowledge() {
    const records = getKnowledge();
    const approved = records.filter((record) => record.status === "approved").length;
    const pending = records.length - approved;
    replacePage("knowledge", `${notice("知识库只展示已导入或手动录入的内容。审核会改变本机记录状态；不会把页面样例当作团队知识。") }<div class="stats-row"><div class="stat-card"><div class="stat-label">对内沉淀</div><div class="stat-value">${records.length}</div></div><div class="stat-card"><div class="stat-label">对外已审</div><div class="stat-value" style="color:#10b981;">${approved}</div></div><div class="stat-card"><div class="stat-label">待审核</div><div class="stat-value" style="color:#f59e0b;">${pending}</div></div><div class="stat-card"><div class="stat-label">团队复用次数</div><div class="stat-value">待导入</div></div></div><div class="tab-bar"><button class="tab-btn active" data-kb-tab="internal">📝 对内沉淀</button><button class="tab-btn" data-kb-tab="external">✅ 对外已审</button><button class="tab-btn" data-kb-tab="upload">⬆️ 上传通道</button></div><div id="cp-kb-search" class="toolbar"><div class="search-box"><span class="search-icon">🔍</span><input id="cp-kb-query" type="search" placeholder="搜索标题、方法论、商品 ID..."></div></div><div id="cp-kb-list">${records.length ? records.map((record) => knowledgeCard(record, true)).join("") : `<div class="card"><div class="ops-empty">暂无真实知识记录。上传 CSV/XLSX/MD/TXT，或从验证有效的动作沉淀。</div></div>`}</div><div id="cp-kb-upload" style="display:none;" class="card"><div class="card-title">📤 导入知识库</div><input id="cp-knowledge-file" type="file" accept=".csv,.xlsx,.xls,.md,.txt"><div id="cp-knowledge-status" style="margin-top:10px;color:#64748b;font-size:12px;">必填：标题、描述；可选：商品ID、动作类型、验证节点、效果。</div></div>`);
    const query = document.getElementById("cp-kb-query");
    const list = document.getElementById("cp-kb-list");
    const filter = () => { const q = text(query?.value).toLowerCase(); const filtered = records.filter((record) => !q || `${record.title} ${record.description} ${record.productId} ${record.actionType}`.toLowerCase().includes(q)); if (list) list.innerHTML = filtered.length ? filtered.map((record) => knowledgeCard(record, true)).join("") : `<div class="card"><div class="ops-empty">没有匹配的真实知识记录。</div></div>`; };
    query?.addEventListener("input", filter);
    document.querySelectorAll("[data-kb-tab]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-kb-tab]").forEach((item) => item.classList.toggle("active", item === button)); const upload = document.getElementById("cp-kb-upload"); if (upload) upload.style.display = button.dataset.kbTab === "upload" ? "block" : "none"; if (list) list.style.display = button.dataset.kbTab === "upload" ? "none" : "block"; if (query?.parentElement?.parentElement) query.parentElement.parentElement.style.display = button.dataset.kbTab === "upload" ? "none" : "flex"; if (button.dataset.kbTab === "external" && list) list.innerHTML = records.filter((record) => record.status === "approved").map((record) => knowledgeCard(record, false)).join("") || `<div class="card"><div class="ops-empty">暂无已审核知识。</div></div>`; else if (button.dataset.kbTab === "internal") filter(); }));
    document.getElementById("cp-knowledge-file")?.addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (!file) return; const status = document.getElementById("cp-knowledge-status"); if (status) status.textContent = "正在解析…"; try { const result = await importKnowledge(file); if (status) status.textContent = `已导入 ${result.knowledge.length} 条，跳过 ${result.errors.length} 条；缺失字段不会入库。`; renderKnowledge(); window.dispatchEvent(new CustomEvent("real-data-imported")); } catch (error) { if (status) status.textContent = `导入失败：${error.message}`; } finally { event.target.value = ""; } });
  }

  function latestStoreSummary() {
    const data = bridge.getData ? bridge.getData() : null;
    const scope = inputScope();
    const rows = [];
    (data?.stores || []).forEach((store) => { const storeLabel = store.name || store.storeName || store.id || "未命名店铺"; if (scope.store !== "all" && storeLabel !== scope.store && store.id !== scope.store) return; const snapshots = (store.snapshots || []).filter((snapshot) => /^20\d{2}-\d{2}-\d{2}$/.test(snapshot.reportDate || "") && (!scope.bounds || ((!scope.bounds.start || snapshot.reportDate >= scope.bounds.start) && (!scope.bounds.end || snapshot.reportDate <= scope.bounds.end)))).sort((a, b) => a.reportDate.localeCompare(b.reportDate)); const snapshot = snapshots[snapshots.length - 1]; if (snapshot) { const products = snapshot.products || []; const knownGmv = products.filter((product) => number(product.gmv) != null); rows.push({ store: storeLabel, date: snapshot.reportDate, products: products.length, gmv: knownGmv.length ? knownGmv.reduce((sum, product) => sum + number(product.gmv), 0) : null }); } });
    return rows;
  }
  function tasks() { return readJson(TASKS_KEY, []); }
  function curateVerifiedActions() {
    const verified = getActions().map(evaluateAction).filter((item) => item.verdict === "有效");
    const records = readJson(KNOWLEDGE_KEY, []);
    verified.forEach((item) => {
      const id = stableId("knowledge-from-action", [item.action.id]);
      if (records.some((record) => record.id === id)) return;
      records.unshift({ id, title: `${item.action.actionType || "运营动作"} · ${item.action.productId || "未指定商品"}`, productId: item.action.productId, store: item.action.store, category: item.action.dimension, actionType: item.action.actionType, verificationNode: item.checks.filter((check) => check.verdict === "有效").map((check) => `T+${check.node}`).join("/"), period: item.action.date, owner: item.action.owner, description: item.action.detail || item.action.actionType, effect: item.checks.filter((check) => check.changePct != null).map((check) => `T+${check.node} ${check.changePct.toFixed(1)}%`).join("；"), status: "pending", source: "知识沉淀 Agent", importedAt: new Date().toISOString() });
    });
    writeJson(KNOWLEDGE_KEY, records);
    return verified.length;
  }
  function taskOutput(type) {
    const actions = getActions().map(evaluateAction);
    const knowledge = getKnowledge();
    if (type === "track-actions") return `扫描 ${actions.length} 条动作：有效 ${actions.filter((item) => item.verdict === "有效").length}，无效 ${actions.filter((item) => item.verdict === "无效").length}，待验证 ${actions.filter((item) => item.verdict === "待验证").length}。`;
    if (type === "knowledge-curation") { const created = curateVerifiedActions(); return `发现 ${actions.filter((item) => item.verdict === "有效").length} 条有效动作，新生成 ${created} 条知识待审核；当前知识记录 ${getKnowledge().length} 条。`; }
    if (type === "diagnose") { const datasets = ["creatorDaily", "affOrders", "samples", "adCreatives", "affVideos", "selfVideos", "orders"].map((key) => `${key}:${getRows(key).length}`).join("，"); return `当前筛选范围数据：${datasets}。结论仅用于定位缺口，不替代人工决策。`; }
    const summaries = latestStoreSummary();
    return summaries.length ? `已读取 ${summaries.length} 个店铺的最新快照：${summaries.map((item) => `${item.store} ${item.date} GMV ${item.gmv == null ? "待导入" : item.gmv}`).join("；")}。` : "暂无有效日期快照，日报任务未生成经营结论。";
  }
  function runAgent(type, label) {
    const record = { id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, agent: label, type, status: "running", createdAt: new Date().toISOString(), output: "本地规则引擎正在读取当前筛选范围…" };
    const next = [record, ...tasks()].slice(0, MAX_TASKS); writeJson(TASKS_KEY, next); renderAgents();
    window.setTimeout(() => { const updated = tasks().map((task) => task.id === record.id ? { ...task, status: "completed", completedAt: new Date().toISOString(), output: taskOutput(type) } : task); writeJson(TASKS_KEY, updated); renderAgents(); }, 250);
  }
  function renderAgents() {
    const history = tasks();
    const running = history.filter((task) => task.status === "running").length;
    const definitions = [{ type: "daily-report", label: "日报汇总 Agent", icon: "📊", desc: "读取当前店铺快照，生成可追溯的日报摘要。" }, { type: "diagnose", label: "经营诊断 Agent", icon: "🔍", desc: "检查各模块数据覆盖，明确缺口，不对缺失字段做推断。" }, { type: "track-actions", label: "效果追踪 Agent", icon: "📈", desc: "按动作记录和 T+1/T+3/T+7 快照验证效果。" }, { type: "knowledge-curation", label: "知识沉淀 Agent", icon: "📚", desc: "把已验证有效动作整理成待审核知识记录。" }];
    replacePage("agents", `${notice("当前 Agent 在 GitHub Pages 上运行本地规则引擎：会真实读取本机导入数据并保存任务历史，但不会冒充已连接外部 LLM、WPS/Kdocs 或 Seller Center。") }<div class="stats-row"><div class="stat-card"><div class="stat-label">运行中 Agent</div><div class="stat-value" style="color:#10b981;">${running}</div></div><div class="stat-card"><div class="stat-label">待执行队列</div><div class="stat-value">0</div></div><div class="stat-card"><div class="stat-label">已完成任务</div><div class="stat-value">${history.filter((task) => task.status === "completed").length}</div></div><div class="stat-card"><div class="stat-label">执行模式</div><div class="stat-value" style="font-size:18px;">本地规则</div></div></div><div class="agent-grid" style="margin-bottom:16px;">${definitions.map((definition) => `<div class="agent-card"><div class="agent-card-status ${running ? "running" : "idle"}"></div><div class="agent-card-icon">${definition.icon}</div><div class="agent-card-body"><div class="agent-card-title">${definition.label}</div><div class="agent-card-desc">${definition.desc}</div><button class="btn btn-primary cp-run-agent" data-agent-type="${definition.type}" data-agent-label="${definition.label}" style="margin-top:10px;">运行</button></div></div>`).join("")}</div><div class="card"><div class="card-title">📈 Agent 执行历史 <span>最近 ${Math.min(history.length, 20)} 条</span></div>${history.length ? `<div class="desktop-table-wrap"><table class="desktop-table"><thead><tr><th>时间</th><th>Agent</th><th>任务</th><th>状态</th><th>输出</th></tr></thead><tbody>${history.slice(0, 20).map((task) => `<tr><td>${esc(new Date(task.createdAt).toLocaleString())}</td><td>${esc(task.agent)}</td><td>${esc(task.type)}</td><td><span class="tag ${task.status === "completed" ? "tag-green" : "tag-yellow"}">${esc(task.status)}</span></td><td>${esc(task.output || "")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="ops-empty">暂无任务。运行一个 Agent 后，这里会留下真实执行记录。</div>`}</div>`);
  }

  function bindDataUpload() {
    const modules = [...document.querySelectorAll(".upload-module")];
    const actionModule = modules.find((module) => module.textContent.includes("运营调整记录"));
    if (!actionModule || actionModule.dataset.cpBound) return;
    actionModule.dataset.cpBound = "1";
    const zone = actionModule.querySelector(".upload-zone");
    if (!zone) return;
    zone.removeAttribute("onclick");
    const input = document.createElement("input"); input.type = "file"; input.accept = ".csv,.xlsx,.xls"; input.hidden = true; input.id = "cp-actions-file"; zone.after(input);
    zone.addEventListener("click", () => input.click());
    input.addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (!file) return; const status = actionModule.querySelector(".tag"); if (status) status.textContent = "正在解析…"; try { const result = await importActions(file); if (status) { status.textContent = `已导入 ${result.actions.length} 条 · 跳过 ${result.errors.length} 条`; status.className = `tag ${result.errors.length ? "tag-yellow" : "tag-green"}`; } window.dispatchEvent(new CustomEvent("real-data-imported")); renderAll(); } catch (error) { if (status) { status.textContent = `导入失败：${error.message}`; status.className = "tag tag-red"; } } finally { event.target.value = ""; } });
  }
  function createKnowledgeFromAction(actionId) {
    const item = getActions().map(evaluateAction).find((entry) => entry.action.id === actionId);
    if (!item || item.verdict !== "有效") return;
    const record = { id: stableId("knowledge-from-action", [actionId]), title: `${item.action.actionType || "运营动作"} · ${item.action.productId || "未指定商品"}`, productId: item.action.productId, category: item.action.dimension, actionType: item.action.actionType, verificationNode: item.checks.filter((check) => check.verdict === "有效").map((check) => `T+${check.node}`).join("/") || item.action.verificationNode, period: item.action.date, owner: item.action.owner, description: item.action.detail || item.action.actionType, effect: item.checks.filter((check) => check.changePct != null).map((check) => `T+${check.node} ${check.changePct.toFixed(1)}%`).join("；"), status: "pending", source: "动作验证 Agent", importedAt: new Date().toISOString() };
    const records = readJson(KNOWLEDGE_KEY, []); if (!records.some((entry) => entry.id === record.id)) { records.unshift(record); writeJson(KNOWLEDGE_KEY, records); }
    renderKnowledge();
  }
  function approveKnowledge(id) { const records = readJson(KNOWLEDGE_KEY, []).map((record) => record.id === id ? { ...record, status: "approved", approvedAt: new Date().toISOString() } : record); writeJson(KNOWLEDGE_KEY, records); renderKnowledge(); }
  function clearDataset(key) { if (key === "actions") writeJson(ACTIONS_KEY, []); if (key === "knowledge") writeJson(KNOWLEDGE_KEY, []); renderAll(); window.dispatchEvent(new CustomEvent("real-data-deleted")); }
  function renderAll() { renderValidation(); renderKnowledge(); renderAgents(); bindDataUpload(); }

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest?.(".cp-create-knowledge"); if (actionButton) { createKnowledgeFromAction(actionButton.dataset.actionId); return; }
    const approveButton = event.target.closest?.(".cp-approve-knowledge"); if (approveButton) { approveKnowledge(approveButton.dataset.knowledgeId); return; }
    const agentButton = event.target.closest?.(".cp-run-agent"); if (agentButton) { runAgent(agentButton.dataset.agentType, agentButton.dataset.agentLabel); }
  });
  document.addEventListener("change", (event) => { if (["store-filter", "date-range-preset", "date-range-start", "date-range-end"].includes(event.target.id)) renderAll(); });
  ["real-data-ready", "real-store-ready", "real-data-imported", "real-data-deleted"].forEach((eventName) => window.addEventListener(eventName, () => window.setTimeout(renderAll, 0)));
  document.getElementById("manual-entry-form")?.addEventListener("submit", () => window.setTimeout(renderAll, 0));
  window.OPS_CONTROL_PLANE = { render: renderAll, getActions, getKnowledge, getTasks: tasks, clearDataset };
  window.setTimeout(renderAll, 0);
})();
