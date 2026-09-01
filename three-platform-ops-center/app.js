(function () {
  "use strict";

  const TEST_MODE = new URLSearchParams(window.location.search).get("test") === "1";
  const STORAGE_KEY = `three-platform-ops-center:v1${TEST_MODE ? ":test" : ""}`;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_ROWS = 10000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const NAV_ITEMS = [
    { id: "overview", label: "经营总览", glyph: "总" },
    { id: "operations", label: "渠道与销售", glyph: "渠" },
    { id: "alerts", label: "交付与预警", glyph: "警" },
    { id: "tasks", label: "任务与实验", glyph: "验" },
    { id: "knowledge", label: "SOP 与知识", glyph: "知" },
    { id: "data", label: "数据与治理", glyph: "数" },
  ];

  const PLATFORM_CONFIG = {
    xiaohongshu: {
      name: "小红书",
      code: "XHS",
      tone: "red",
      referenceField: "content_ref",
      orderKey: "orders",
      template: "templates/xiaohongshu-pilot.csv",
      sourceLabel: "专业号后台 / 手工导出",
      route: ["曝光", "阅读/观看", "互动", "留资/出单"],
      metrics: [
        ["impressions", "曝光"],
        ["reads", "图文阅读"],
        ["views", "视频观看"],
        ["comments", "评论"],
        ["shares", "分享/转发"],
        ["orders", "支付订单"],
      ],
      allMetrics: [
        "impressions", "reads", "views", "likes", "comments", "shares", "saves",
        "profile_visits", "lead_count", "orders",
      ],
    },
    douyin: {
      name: "抖音",
      code: "DY",
      tone: "cyan",
      referenceField: "content_ref",
      orderKey: "orders",
      template: "templates/douyin-pilot.csv",
      sourceLabel: "抖音创作者中心 / 电商罗盘",
      route: ["曝光", "播放", "完播", "点击/出单"],
      metrics: [
        ["impressions", "曝光"],
        ["plays", "播放"],
        ["comments", "评论"],
        ["shares", "分享/转发"],
        ["completions", "完播"],
        ["orders", "支付订单"],
      ],
      allMetrics: [
        "impressions", "plays", "plays_2s", "plays_5s", "completions", "likes",
        "comments", "shares", "followers_delta", "product_clicks", "orders", "revenue",
      ],
    },
    xianyu: {
      name: "闲鱼",
      code: "XY",
      tone: "yellow",
      referenceField: "listing_ref",
      orderKey: "paid_orders",
      template: "templates/xianyu-pilot.csv",
      sourceLabel: "闲鱼卖家后台 / 手工台账",
      route: ["曝光", "浏览", "想要/咨询", "支付订单"],
      metrics: [
        ["impressions", "曝光"],
        ["views", "浏览"],
        ["wants", "想要"],
        ["inquiries", "有效咨询"],
        ["paid_orders", "支付订单"],
        ["revenue", "成交金额"],
      ],
      allMetrics: [
        "impressions", "views", "wants", "inquiries", "paid_orders", "fulfilled_orders",
        "refunds", "revenue", "stock",
      ],
    },
  };

  const METRIC_LABELS = Object.fromEntries(
    Object.values(PLATFORM_CONFIG)
      .flatMap((platform) => platform.metrics)
      .concat([
        ["likes", "点赞"], ["saves", "收藏"], ["profile_visits", "主页访问"],
        ["lead_count", "留资"], ["plays_2s", "2 秒播放"], ["plays_5s", "5 秒播放"],
        ["followers_delta", "粉丝净增"], ["product_clicks", "商品点击"],
        ["fulfilled_orders", "已完成订单"], ["refunds", "退款"], ["stock", "库存"],
      ]),
  );

  const SENSITIVE_HEADER_PATTERNS = [
    /password|passwd|pwd/i,
    /cookie|session/i,
    /token|secret|authorization|api[_-]?key/i,
    /buyer|收货|地址|address|手机号|mobile|phone|email|身份证|id[_-]?card/i,
    /聊天|chat|message|私信|dm[_-]?content/i,
  ];

  const appElement = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");

  let state = loadState();
  let ui = {
    view: readViewFromHash(),
    platform: "all",
    account: "all",
    period: "7",
    routePlatform: "xiaohongshu",
    modal: null,
    modalPayload: null,
  };

  function createDefaultState() {
    return {
      version: 1,
      accounts: [],
      snapshots: [],
      imports: [],
      tasks: [],
      handledAlerts: [],
      updatedAt: null,
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (!saved || saved.version !== 1) return createDefaultState();
      return {
        ...createDefaultState(),
        ...saved,
        accounts: Array.isArray(saved.accounts) ? saved.accounts : [],
        snapshots: Array.isArray(saved.snapshots) ? saved.snapshots : [],
        imports: Array.isArray(saved.imports) ? saved.imports : [],
        tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
        handledAlerts: Array.isArray(saved.handledAlerts) ? saved.handledAlerts : [],
      };
    } catch (error) {
      console.warn("Unable to load local state", error);
      return createDefaultState();
    }
  }

  function persistState() {
    state.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Unable to persist local state", error);
      showToast("浏览器存储失败，请先导出备份或清理空间。", "error");
      return false;
    }
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readViewFromHash() {
    const view = window.location.hash.replace(/^#/, "");
    return NAV_ITEMS.some((item) => item.id === view) ? view : "overview";
  }

  function formatNumber(value, options = {}) {
    if (value === undefined || value === null || Number.isNaN(value)) return "待导入";
    if (options.currency) {
      return new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        maximumFractionDigits: 2,
      }).format(value);
    }
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
  }

  function formatTime(value) {
    if (!value) return "待导入";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间无效";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(date);
  }

  function formatDate(value) {
    if (!value) return "待导入";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间无效";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
  }

  function safeProfileUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function hasMetric(metrics, key) {
    return Object.prototype.hasOwnProperty.call(metrics || {}, key);
  }

  function metricValue(metrics, key) {
    return hasMetric(metrics, key) ? metrics[key] : undefined;
  }

  function getPlatformAccounts(platformId) {
    return state.accounts.filter((account) => platformId === "all" || account.platform === platformId);
  }

  function getScopedAccounts() {
    return state.accounts.filter((account) => {
      if (ui.platform !== "all" && account.platform !== ui.platform) return false;
      if (ui.account !== "all" && account.id !== ui.account) return false;
      return true;
    });
  }

  function getLatestSnapshotsByAccount(accounts = getScopedAccounts()) {
    const accountIds = new Set(accounts.map((account) => account.id));
    const relevant = state.snapshots
      .filter((snapshot) => accountIds.has(snapshot.accountId))
      .sort((left, right) => new Date(right.observedAt) - new Date(left.observedAt));
    const newestDate = relevant.length ? new Date(relevant[0].observedAt) : null;
    const periodDays = ui.period === "all" ? null : Number(ui.period);
    const periodStart = newestDate && periodDays
      ? new Date(newestDate.getTime() - (periodDays - 1) * DAY_MS)
      : null;
    const latest = new Map();
    relevant.forEach((snapshot) => {
      if (periodStart && new Date(snapshot.observedAt) < periodStart) return;
      if (!latest.has(snapshot.accountId)) latest.set(snapshot.accountId, snapshot);
    });
    return latest;
  }

  function getPreviousSnapshot(accountId, latestSnapshot) {
    return state.snapshots
      .filter((snapshot) => snapshot.accountId === accountId && snapshot.id !== latestSnapshot?.id)
      .sort((left, right) => new Date(right.observedAt) - new Date(left.observedAt))[0] || null;
  }

  function aggregateMetrics(snapshots, platformId) {
    const config = PLATFORM_CONFIG[platformId];
    const result = {};
    snapshots.forEach((snapshot) => {
      config.allMetrics.forEach((key) => {
        if (!hasMetric(snapshot.metrics, key)) return;
        result[key] = (result[key] || 0) + snapshot.metrics[key];
      });
    });
    return result;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];
      if (quoted) {
        if (character === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field.replace(/\r$/, ""));
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    if (quoted) throw new Error("CSV 存在未闭合的引号。");
    row.push(field.replace(/\r$/, ""));
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    if (!rows.length) throw new Error("CSV 为空。");

    const headers = rows[0].map((header, index) =>
      (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim(),
    );
    const normalizedHeaders = headers.map((header) => header.toLowerCase());
    if (headers.some((header) => !header)) throw new Error("CSV 表头不能为空。");
    if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
      throw new Error("CSV 存在重复表头。");
    }
    if (headers.some((header) => SENSITIVE_HEADER_PATTERNS.some((pattern) => pattern.test(header)))) {
      throw new Error("检测到密码、Cookie、买家隐私或聊天内容等敏感字段，已阻止导入。");
    }

    const dataRows = rows.slice(1);
    if (dataRows.length > MAX_ROWS) throw new Error(`单次最多导入 ${MAX_ROWS} 行。`);
    return {
      headers: normalizedHeaders,
      rows: dataRows.map((cells) => Object.fromEntries(
        normalizedHeaders.map((header, index) => [header, (cells[index] || "").trim()]),
      )),
    };
  }

  function buildSnapshotFromCsv({ platformId, account, fileName, csv }) {
    const config = PLATFORM_CONFIG[platformId];
    const requiredHeaders = ["observed_at", "account_ref", config.referenceField];
    requiredHeaders.forEach((header) => {
      if (!csv.headers.includes(header)) throw new Error(`缺少必填表头：${header}`);
    });
    if (!csv.rows.length) throw new Error("CSV 没有数据行。");

    const aggregate = {};
    const references = new Set();
    let latestObservedAt = null;

    csv.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      if (row.account_ref !== account.accountRef) {
        throw new Error(`第 ${rowNumber} 行 account_ref 与所选账号不一致。`);
      }
      if (!row[config.referenceField]) {
        throw new Error(`第 ${rowNumber} 行 ${config.referenceField} 不能为空。`);
      }
      const observedAt = new Date(row.observed_at);
      if (Number.isNaN(observedAt.getTime())) {
        throw new Error(`第 ${rowNumber} 行 observed_at 不是有效时间。`);
      }
      if (!latestObservedAt || observedAt > latestObservedAt) latestObservedAt = observedAt;
      references.add(row[config.referenceField]);

      config.allMetrics.forEach((metricKey) => {
        const rawValue = row[metricKey];
        if (rawValue === undefined || rawValue === "") return;
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
          throw new Error(`第 ${rowNumber} 行 ${metricKey} 必须是数字或留空。`);
        }
        if (metricKey !== "followers_delta" && numericValue < 0) {
          throw new Error(`第 ${rowNumber} 行 ${metricKey} 不能为负数。`);
        }
        aggregate[metricKey] = (aggregate[metricKey] || 0) + numericValue;
      });
    });

    return {
      id: createId("snapshot"),
      accountId: account.id,
      platform: platformId,
      observedAt: latestObservedAt.toISOString(),
      importedAt: new Date().toISOString(),
      fileName,
      rowCount: csv.rows.length,
      referenceCount: references.size,
      metrics: aggregate,
      sourceType: "csv-local",
    };
  }

  function deriveAlerts() {
    const alerts = [];
    state.accounts.forEach((account) => {
      const config = PLATFORM_CONFIG[account.platform];
      const latest = state.snapshots
        .filter((snapshot) => snapshot.accountId === account.id)
        .sort((left, right) => new Date(right.observedAt) - new Date(left.observedAt))[0];
      if (!account.verifiedAt) {
        alerts.push({
          id: `unverified:${account.id}`,
          level: "基础",
          platform: account.platform,
          title: `${account.displayName} 尚未完成本地核验`,
          evidence: `账号编号 ${account.accountRef} 已登记，但未记录核验时间。`,
          uncertainty: "未登录平台后台，本系统不自动判断账号归属。",
          action: "由负责人打开公开主页或后台，核对编号后点击“本地核验”。",
        });
      }
      if (!latest) {
        alerts.push({
          id: `missing:${account.id}`,
          level: "缺口",
          platform: account.platform,
          title: `${account.displayName} 尚无运营快照`,
          evidence: `已登记 ${config.name} 账号，但没有导入任何 CSV。`,
          uncertainty: "没有数据时不判断涨跌，也不把未知写成 0。",
          action: `下载 ${config.name} 模板并导入第一份后台快照。`,
        });
        return;
      }
      const ageDays = Math.floor((Date.now() - new Date(latest.observedAt).getTime()) / DAY_MS);
      if (ageDays > 7) {
        alerts.push({
          id: `stale:${account.id}:${latest.id}`,
          level: "时效",
          platform: account.platform,
          title: `${account.displayName} 数据已超过 7 天`,
          evidence: `最近观测时间为 ${formatDate(latest.observedAt)}，距今约 ${ageDays} 天。`,
          uncertainty: "旧快照只能说明历史状态，不能代表当前流量。",
          action: "重新从平台后台导出同口径数据并导入。",
        });
      }
      if (!hasMetric(latest.metrics, config.orderKey)) {
        alerts.push({
          id: `orders:${account.id}:${latest.id}`,
          level: "经营",
          platform: account.platform,
          title: `${account.displayName} 的出单字段待导入`,
          evidence: `最近快照含 ${latest.rowCount} 行，但 ${METRIC_LABELS[config.orderKey]} 字段为空。`,
          uncertainty: "字段为空不等于 0 单。",
          action: "从电商后台或订单台账补录支付订单字段，再重新导入。",
        });
      }
    });
    return alerts.map((alert) => ({
      ...alert,
      handled: state.handledAlerts.includes(alert.id),
    }));
  }

  function deriveRecommendations() {
    const recommendations = [];
    const alerts = deriveAlerts().filter((alert) => !alert.handled);
    alerts.slice(0, 2).forEach((alert) => {
      recommendations.push({
        id: `alert-task:${alert.id}`,
        platform: alert.platform,
        title: alert.title,
        reason: alert.action,
        source: "数据缺口",
      });
    });

    const scopedAccounts = getScopedAccounts();
    const latestMap = getLatestSnapshotsByAccount(scopedAccounts);
    for (const account of scopedAccounts) {
      if (recommendations.length >= 3) break;
      const latest = latestMap.get(account.id);
      if (!latest) continue;
      const config = PLATFORM_CONFIG[account.platform];
      const previous = getPreviousSnapshot(account.id, latest);
      const orderKey = config.orderKey;
      const orderValue = metricValue(latest.metrics, orderKey);
      const trafficKey = account.platform === "douyin" ? "plays" : "views";
      const trafficValue = metricValue(latest.metrics, trafficKey) ?? metricValue(latest.metrics, "impressions");
      if (orderValue === 0 && typeof trafficValue === "number" && trafficValue > 0) {
        recommendations.push({
          id: `conversion:${latest.id}`,
          platform: account.platform,
          title: `检查 ${account.displayName} 的流量到出单断点`,
          reason: `已有 ${formatNumber(trafficValue)} 次${METRIC_LABELS[trafficKey] || "流量"}，支付订单明确为 0；先核对商品承接与咨询回复。`,
          source: "同批事实",
        });
        continue;
      }
      if (previous && hasMetric(latest.metrics, orderKey) && hasMetric(previous.metrics, orderKey)) {
        const delta = latest.metrics[orderKey] - previous.metrics[orderKey];
        if (delta < 0) {
          recommendations.push({
            id: `order-drop:${latest.id}`,
            platform: account.platform,
            title: `复盘 ${account.displayName} 的订单回落`,
            reason: `同账号相邻两次快照订单变化 ${formatNumber(delta)}；先核对时间口径，再查流量与承接环节。`,
            source: "相邻快照",
          });
        }
      }
    }

    if (!recommendations.length) {
      const missingPlatforms = Object.keys(PLATFORM_CONFIG)
        .filter((platformId) => !state.accounts.some((account) => account.platform === platformId));
      missingPlatforms.slice(0, 3).forEach((platformId) => {
        const config = PLATFORM_CONFIG[platformId];
        recommendations.push({
          id: `register:${platformId}`,
          platform: platformId,
          title: `登记第一个${config.name}真实运营账号`,
          reason: "只登记账号编号、负责人和目标，不收集密码、Cookie 或买家隐私。",
          source: "启动动作",
        });
      });
    }
    return recommendations.slice(0, 3);
  }

  function platformReadiness(platformId) {
    const accounts = state.accounts.filter((account) => account.platform === platformId);
    if (!accounts.length) return { score: 0, stage: 0, label: "待登记" };
    const snapshots = getLatestSnapshotsByAccount(accounts);
    const verifiedCount = accounts.filter((account) => account.verifiedAt).length;
    const snapshotCount = accounts.filter((account) => snapshots.has(account.id)).length;
    const orderKnownCount = accounts.filter((account) => {
      const snapshot = snapshots.get(account.id);
      return snapshot && hasMetric(snapshot.metrics, PLATFORM_CONFIG[platformId].orderKey);
    }).length;
    const verifiedRatio = verifiedCount / accounts.length;
    const snapshotRatio = snapshotCount / accounts.length;
    const orderRatio = orderKnownCount / accounts.length;
    const score = Math.round((0.25 + verifiedRatio * 0.2 + snapshotRatio * 0.3 + orderRatio * 0.25) * 100);
    const stage = orderRatio === 1 ? 4 : snapshotRatio === 1 ? 3 : verifiedRatio === 1 ? 2 : 1;
    const labels = ["待登记", "已登记", "已核验", "有流量快照", "可判断出单"];
    return { score, stage, label: labels[stage] };
  }

  function overallReadiness() {
    const values = Object.keys(PLATFORM_CONFIG).map((platformId) => platformReadiness(platformId).score);
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  function scopeSummary() {
    const accountCount = getScopedAccounts().length;
    const sourceCount = getLatestSnapshotsByAccount().size;
    const alerts = deriveAlerts().filter((alert) => !alert.handled);
    const latestObservedAt = state.snapshots
      .map((snapshot) => snapshot.observedAt)
      .sort((left, right) => new Date(right) - new Date(left))[0] || null;
    return { accountCount, sourceCount, alerts, latestObservedAt };
  }

  function render() {
    const summary = scopeSummary();
    const alertCount = summary.alerts.length;
    const currentNav = NAV_ITEMS.find((item) => item.id === ui.view) || NAV_ITEMS[0];
    appElement.innerHTML = `
      <div class="app-shell">
        ${renderSidebar(alertCount)}
        <main class="app-main">
          <header class="topbar">
            <div>
              <p>${formatDate(new Date().toISOString())} · ${TEST_MODE ? "测试隔离模式" : "浏览器本地操盘"}</p>
              <h1>${escapeHtml(currentNav.label)}</h1>
            </div>
            <div class="topbar-actions">
              <a class="prototype-badge static-mode-badge" href="https://three-platform-ops-center.nanana1sd.chatgpt.site/?v=8#overview" target="_blank" rel="noreferrer">打开私有完整版</a>
              <button class="topbar-import-button" type="button" data-action="open-import"><span>＋</span> 导入数据</button>
              <button type="button" data-action="go-alerts" aria-label="打开预警">铃${alertCount ? `<em>${alertCount}</em>` : ""}</button>
              <span class="avatar" aria-label="Harry">H</span>
            </div>
          </header>
          ${renderContextBar(summary)}
          <div class="content-wrap">${renderCurrentView()}</div>
        </main>
        ${renderMobileNav(alertCount)}
        <button class="mobile-import-action" type="button" data-action="open-import">＋ 导入</button>
      </div>
    `;
  }

  function renderSidebar(alertCount) {
    return `
      <aside class="sidebar">
        <a class="brand-lockup" href="#overview" aria-label="Codex Business OS 首页">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <div><strong>Codex Business OS</strong><span>AI SERVICE OPERATIONS</span></div>
        </a>
        <p class="nav-caption">工作区</p>
        <nav class="side-nav" aria-label="主导航">
          ${NAV_ITEMS.map((item) => `
            <a href="#${item.id}" class="${ui.view === item.id ? "active" : ""}">
              <span class="nav-glyph">${item.glyph}</span>
              <span>${item.label}</span>
              ${item.id === "alerts" && alertCount ? `<em>${alertCount}</em>` : ""}
            </a>
          `).join("")}
        </nav>
        <div class="sidebar-foot">
          <div class="environment-pill"><i></i> 团队经营版</div>
          <p>客户、订单、交付、续费<br />未知不写成 0 · 来源可追溯</p>
        </div>
      </aside>
    `;
  }

  function renderMobileNav(alertCount) {
    const mobileItems = NAV_ITEMS.slice(0, 4);
    return `
      <nav class="mobile-nav" aria-label="移动端导航">
        ${mobileItems.map((item) => `
          <a href="#${item.id}" class="${ui.view === item.id ? "active" : ""}">
            <span>${item.glyph}${item.id === "alerts" && alertCount ? `<em>${alertCount}</em>` : ""}</span>
            ${item.label.replace("与实验", "")}
          </a>
        `).join("")}
      </nav>
    `;
  }

  function renderContextBar(summary) {
    const platformAccounts = getPlatformAccounts(ui.platform);
    if (ui.account !== "all" && !platformAccounts.some((account) => account.id === ui.account)) {
      ui.account = "all";
    }
    return `
      <section class="context-bar" aria-label="数据范围">
        <label><span>平台</span>
          <select id="platform-filter">
            <option value="all" ${ui.platform === "all" ? "selected" : ""}>全部平台</option>
            ${Object.entries(PLATFORM_CONFIG).map(([id, config]) =>
              `<option value="${id}" ${ui.platform === id ? "selected" : ""}>${config.name}</option>`,
            ).join("")}
          </select>
        </label>
        <label><span>账号 / 店铺</span>
          <select id="account-filter">
            <option value="all">全部已登记账号</option>
            ${platformAccounts.map((account) =>
              `<option value="${account.id}" ${ui.account === account.id ? "selected" : ""}>${escapeHtml(account.displayName)} · ${escapeHtml(account.accountRef)}</option>`,
            ).join("")}
          </select>
        </label>
        <label><span>时间</span>
          <select id="period-filter">
            <option value="7" ${ui.period === "7" ? "selected" : ""}>近 7 天</option>
            <option value="14" ${ui.period === "14" ? "selected" : ""}>近 14 天</option>
            <option value="30" ${ui.period === "30" ? "selected" : ""}>近 30 天</option>
            <option value="all" ${ui.period === "all" ? "selected" : ""}>全部快照</option>
          </select>
        </label>
        <div class="scope-static"><span>本地来源</span><b>${summary.sourceCount} 个最新快照</b></div>
        <div class="freshness">
          <i class="status-dot ${summary.latestObservedAt ? "green" : "amber"}"></i>
          <div><b>${summary.latestObservedAt ? "最近观测 " + formatTime(summary.latestObservedAt) : "尚无数据接入"}</b><small>仅浏览器本地 · 不自动上传</small></div>
          <button type="button" data-action="go-data">治理</button>
        </div>
      </section>
    `;
  }

  function renderCodexOverview() {
    const alerts = deriveAlerts().filter((alert) => !alert.handled);
    const taskCount = state.tasks.filter((task) => !task.completedAt).length;
    const orderCount = state.snapshots.reduce((sum, snapshot) => sum + Number(snapshot.orders || snapshot.paid_orders || 0), 0);
    const hasRealData = state.accounts.length || state.snapshots.length;
    const kpis = [["新增线索", "待接入", "今日"], ["有效咨询", "待接入", "今日"], ["成交订单", orderCount ? formatNumber(orderCount) : "—", "来自已导入事实"], ["待交付订单", "待登记", "订单台账"], ["7天内到期", "待接入", "续费看板"], ["开放预警", String(alerts.length), alerts.length ? "需要处理" : "暂无"]];
    return `
      <section class="codex-hero"><div><div class="eyebrow"><i class="status-dot cyan"></i> CODEX BUSINESS OS · 2026-09-01</div><h2>把每一笔成交，变成可交付、可复购的服务。</h2><p>这是团队的 AI 订阅协助、Codex 配置、培训与持续支持经营中台。渠道负责带来线索，订单负责产生现金流，交付与续费负责验证业务是否真的成立。</p><div class="decision-actions"><button class="primary-button" type="button" data-action="go-tasks">进入订单与交付任务<span>→</span></button><button class="text-button" type="button" data-action="go-tasks">打开今日任务</button></div></div><div class="codex-hero-note"><span>本周唯一目标</span><strong>验证一个稳定交付且贡献为正的 SKU</strong><small>${hasRealData ? "已有本地业务数据，继续补齐订单与交付字段" : "先登记客户与第一笔订单，再开始积累真实数据"}</small></div></section>
      <section class="section-block"><div class="section-heading"><div><span>OPERATING PULSE</span><h2>今日经营脉搏</h2></div><p>空白代表待接入，不把未知写成 0</p></div><div class="codex-kpi-grid">${kpis.map(([label,value,meta]) => `<article class="codex-kpi"><span>${label}</span><b>${value}</b><small>${meta}</small></article>`).join("")}</div></section>
      <section class="codex-grid-2 section-block"><article class="workspace-surface codex-funnel"><div class="surface-heading"><div><h3>客户与订单漏斗</h3><p>从首次咨询到续费的唯一经营链路</p></div><span>本周</span></div><div class="funnel-steps"><div><b>01</b><span>获客</span><em>渠道与内容</em></div><div><b>02</b><span>咨询</span><em>需求与报价</em></div><div><b>03</b><span>成交</span><em>实收与 SKU</em></div><div><b>04</b><span>交付</span><em>激活与确认</em></div><div><b>05</b><span>续费</span><em>复购与支持</em></div></div></article><article class="workspace-surface codex-priority"><div class="surface-heading"><div><h3>现在最该处理</h3><p>优先解决阻塞现金流的事项</p></div><button type="button" data-action="go-alerts">查看预警</button></div><ul class="priority-list"><li><span class="priority-dot red"></span><div><b>${alerts.length ? `${alerts.length} 个开放预警等待处理` : "暂无开放预警"}</b><small>${alerts.length ? "先处理交付、退款和数据缺口" : "继续记录真实订单与售后事实"}</small></div><button type="button" data-action="go-alerts">处理</button></li><li><span class="priority-dot amber"></span><div><b>${taskCount ? `${taskCount} 项任务尚未完成` : "今天还没有执行任务"}</b><small>把结论变成负责人和截止时间</small></div><button type="button" data-action="go-tasks">打开</button></li><li><span class="priority-dot cyan"></span><div><b>检查当前价盘与供应商评分</b><small>旧资料只作参考，当前价格必须重新核验</small></div><button type="button" data-action="go-data">治理</button></li></ul></article></section>
      <section class="section-block"><div class="section-heading"><div><span>BUSINESS MODULES</span><h2>业务模块</h2></div><p>围绕客户、产品、交付和现金流组织工作</p></div><div class="module-grid">${[["客户与订单","管理客户阶段、订单金额和负责人","go-tasks"],["产品与 SKU","定义服务边界、价格与贡献","go-data"],["交付与售后","记录激活、问题和处理时长","go-alerts"],["续费与复购","跟进到期、复购和流失原因","go-tasks"],["渠道与销售","比较闲鱼、内容和私域的真实成交","go-platform"],["数据与证据","保留来源、复核日和决策依据","go-data"]].map(([title,desc,action]) => `<button class="module-card" type="button" data-action="${action}"><span>${title}</span><b>→</b><small>${desc}</small></button>`).join("")}</div></section>
      <div class="governance-strip"><span>TEAM OPERATING RULE</span><p>不把共享账号、接码或规避平台限制作为默认主业务；不在网页或笔记中保存密码、Cookie、Token、API Key。</p><button type="button" class="text-button" data-action="go-data">打开数据治理 →</button></div>`;
  }

  function renderCurrentView() {
    const renderers = {
      overview: renderCodexOverview,
      operations: renderOperations,
      alerts: renderAlerts,
      tasks: renderTasks,
      knowledge: renderKnowledge,
      data: renderData,
    };
    return (renderers[ui.view] || renderOverview)();
  }

  function renderOverview() {
    const accounts = getScopedAccounts();
    const latestMap = getLatestSnapshotsByAccount(accounts);
    const alerts = deriveAlerts().filter((alert) => !alert.handled);
    const recommendations = deriveRecommendations();
    const hasData = latestMap.size > 0;
    const headline = !state.accounts.length
      ? "先登记真实账号，再让每个判断都有出处。"
      : !hasData
        ? "账号已登记，下一步补齐第一份运营快照。"
        : alerts.length
          ? `今天先处理 ${alerts.length} 个证据缺口，再判断运营涨跌。`
          : "当前数据链完整，可以进入平台复盘与实验。";
    const description = !hasData
      ? "系统不会用公开主页代替后台区间数据，也不会把空字段写成 0。先用平台模板导入曝光、互动与出单事实。"
      : "当前结论来自所选范围内每个账号的最新快照。相邻快照只用于变化提示，出单字段为空仍显示“待导入”。";

    return `
      <section class="decision-panel">
        <div class="decision-main">
          <div class="eyebrow"><i class="status-dot amber"></i> 今日判断 · 本地证据</div>
          <h2>${headline}</h2>
          <p>${description}</p>
          <div class="decision-actions">
            <button class="primary-button" type="button" data-action="${state.accounts.length ? "open-import" : "open-register"}">
              ${state.accounts.length ? "导入一份后台快照" : "登记真实账号"}<span>→</span>
            </button>
            <button class="text-button" type="button" data-action="go-tasks">查看执行清单</button>
            <span class="decision-reassurance">不收账号密码、Cookie、买家聊天或收货信息</span>
          </div>
        </div>
        <div class="decision-evidence">
          <div><span>已登记账号</span><b>${accounts.length}</b><small>${accounts.filter((account) => account.verifiedAt).length} 个已本地核验</small></div>
          <div><span>有效数据来源</span><b>${latestMap.size}</b><small>${state.imports.length} 个本地导入批次</small></div>
          <div><span>当前开放预警</span><b>${alerts.length}</b><small>${alerts.filter((alert) => alert.level === "经营").length} 个出单字段缺口</small></div>
        </div>
      </section>
      ${renderReadinessNavigator()}
      <section class="section-block">
        <div class="section-heading"><div><span>NOW</span><h2>今天只推进最关键动作</h2></div><p>最多 3 项 · 每项都说明证据来源</p></div>
        <div class="action-list">
          ${recommendations.map((recommendation, index) => renderRecommendation(recommendation, index)).join("")}
        </div>
      </section>
      <section class="section-block">
        <div class="section-heading"><div><span>ACCOUNT MONITORING</span><h2>三平台原生指标与出单状态</h2></div><p>点击平台卡片进入对应工作台</p></div>
        <div class="platform-grid ${ui.platform !== "all" ? "scoped" : ""}">
          ${Object.keys(PLATFORM_CONFIG)
            .filter((platformId) => ui.platform === "all" || ui.platform === platformId)
            .map((platformId) => renderPlatformPanel(platformId, accounts, latestMap))
            .join("")}
        </div>
      </section>
      ${renderOverviewLowerGrid(accounts, latestMap, alerts)}
      <div class="governance-strip">
        <span>STATIC BOUNDARY</span>
        <p>GitHub 版只在当前浏览器保存数据；需要安全登录、多人同步、审批、D1 审计或后台采集时，请使用私有动态版。</p>
        <a href="https://three-platform-ops-center.nanana1sd.chatgpt.site/?v=8#overview" target="_blank" rel="noreferrer">打开私有完整版 →</a>
      </div>
    `;
  }

  function renderRecommendation(recommendation, index) {
    const platform = PLATFORM_CONFIG[recommendation.platform];
    const existingTask = state.tasks.find((task) => task.sourceId === recommendation.id);
    return `
      <article class="action-row">
        <span class="action-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="platform-tag">${platform.name}</span>
        <div><h3>${escapeHtml(recommendation.title)}</h3><p>${escapeHtml(recommendation.reason)} · 来源：${recommendation.source}</p></div>
        <button type="button" class="${existingTask ? "assigned" : ""}" data-action="create-recommendation-task" data-source-id="${escapeHtml(recommendation.id)}" ${existingTask ? "disabled" : ""}>
          ${existingTask ? "已进入任务" : "加入执行"}
        </button>
      </article>
    `;
  }

  function renderReadinessNavigator() {
    const activeConfig = PLATFORM_CONFIG[ui.routePlatform];
    const activeReadiness = platformReadiness(ui.routePlatform);
    const scores = Object.fromEntries(
      Object.keys(PLATFORM_CONFIG).map((platformId) => [platformId, platformReadiness(platformId)]),
    );
    const radii = { xiaohongshu: 41, douyin: 32, xianyu: 23 };
    return `
      <section class="readiness-navigator">
        <header class="readiness-heading">
          <div><span>OPERATING READINESS</span><h2>动态操盘导航</h2><p>圆环不是装饰：账号登记、核验、流量快照和出单字段每完成一层，才推进一段。</p></div>
          <div class="readiness-summary"><span>整体就绪度</span><b>${overallReadiness()}%</b><small>三平台平均</small></div>
        </header>
        <div class="readiness-body">
          <div class="readiness-visual">
            <svg viewBox="0 0 110 110" role="img" aria-label="三平台数据就绪度动态圆环">
              ${Object.entries(PLATFORM_CONFIG).map(([platformId, config]) => {
                const radius = radii[platformId];
                const readiness = scores[platformId];
                return `
                  <circle class="readiness-track ${config.tone} ${ui.routePlatform === platformId ? "active" : ""}" cx="55" cy="55" r="${radius}" pathLength="100"></circle>
                  <circle class="readiness-arc ${config.tone} ${ui.routePlatform === platformId ? "active" : ""}" cx="55" cy="55" r="${radius}" pathLength="100" stroke-dasharray="${readiness.score} ${100 - readiness.score}" stroke-linecap="round" transform="rotate(-90 55 55)"></circle>
                `;
              }).join("")}
              <circle class="readiness-core" cx="55" cy="55" r="14"></circle>
              <text class="readiness-score" x="55" y="55" text-anchor="middle" dominant-baseline="central">${activeReadiness.score}</text>
              <text class="readiness-score-label" x="55" y="65" text-anchor="middle">READY</text>
            </svg>
            <div class="readiness-legend"><span class="red">小红书</span><span class="cyan">抖音</span><span class="yellow">闲鱼</span></div>
          </div>
          <div class="route-selector">
            ${Object.entries(PLATFORM_CONFIG).map(([platformId, config]) => {
              const readiness = scores[platformId];
              return `
                <button type="button" class="${config.tone} ${ui.routePlatform === platformId ? "active" : ""}" data-action="select-route" data-platform="${platformId}">
                  <span class="route-platform"><i></i>${config.name}</span><b>${readiness.score}%</b>
                  <small>${readiness.label}</small><em>→</em>
                </button>
              `;
            }).join("")}
          </div>
          <div class="navigator-insight">
            <span class="active-platform ${activeConfig.tone}">${activeConfig.name} · ${activeReadiness.label}</span>
            <h3>${readinessActionTitle(ui.routePlatform, activeReadiness.stage)}</h3>
            <p>${readinessActionDescription(ui.routePlatform, activeReadiness.stage)}</p>
            <ol class="route-stages">
              ${activeConfig.route.map((label, index) => {
                const stageIndex = index + 1;
                const status = stageIndex < activeReadiness.stage ? "done" : stageIndex === activeReadiness.stage ? "current" : "";
                return `<li class="${status}"><span>${stageIndex < activeReadiness.stage ? "✓" : stageIndex}</span>${label}</li>`;
              }).join("")}
            </ol>
            <button class="secondary-button navigator-action" type="button" data-action="route-next" data-platform="${ui.routePlatform}">${activeReadiness.stage < 2 ? "登记 / 核验账号" : "进入平台工作台"} →</button>
          </div>
        </div>
      </section>
    `;
  }

  function readinessActionTitle(platformId, stage) {
    const platformName = PLATFORM_CONFIG[platformId].name;
    if (stage === 0) return `先登记一个${platformName}真实账号`;
    if (stage === 1) return "核验账号身份，再开始导入";
    if (stage === 2) return "导入第一份同口径后台快照";
    if (stage === 3) return "补齐支付订单字段，闭合经营链路";
    return "证据链已闭合，进入相邻快照复盘";
  }

  function readinessActionDescription(platformId, stage) {
    const config = PLATFORM_CONFIG[platformId];
    if (stage === 0) return `只登记账号编号、负责人和经营目标；系统不会收取${config.name}密码或 Cookie。`;
    if (stage === 1) return "本地核验只记录负责人确认事实，不替代平台官方授权，也不会自动登录账号。";
    if (stage === 2) return `使用 ${config.name} CSV 模板导入后台数据，空字段继续保持“待导入”。`;
    if (stage === 3) return `流量事实已有来源，但 ${METRIC_LABELS[config.orderKey]} 仍需订单后台证据，不能根据互动量推测。`;
    return "继续按同账号、同字段、同时间口径导入下一批快照，才能比较变化并验证动作。";
  }

  function renderPlatformPanel(platformId, scopedAccounts, latestMap) {
    const config = PLATFORM_CONFIG[platformId];
    const accounts = scopedAccounts.filter((account) => account.platform === platformId);
    const snapshots = accounts.map((account) => latestMap.get(account.id)).filter(Boolean);
    const metrics = aggregateMetrics(snapshots, platformId);
    const orderKnown = snapshots.length > 0 && snapshots.every((snapshot) => hasMetric(snapshot.metrics, config.orderKey));
    const orders = orderKnown ? snapshots.reduce((sum, snapshot) => sum + snapshot.metrics[config.orderKey], 0) : undefined;
    const orderClass = orders === undefined ? "pending" : orders > 0 ? "ready" : "idle";
    const orderText = orders === undefined ? "待导入" : orders > 0 ? `已出单 · ${formatNumber(orders)} 单` : "已导入 · 0 单";
    const latestTime = snapshots.map((snapshot) => snapshot.observedAt).sort((left, right) => new Date(right) - new Date(left))[0];
    return `
      <button class="platform-panel ${config.tone}" type="button" data-action="open-platform" data-platform="${platformId}">
        <header><span class="platform-code">${config.code}</span><div><h3>${config.name}</h3><p>${accounts.length} 个账号 · ${snapshots.length} 个最新快照</p></div><em>${platformReadiness(platformId).label}</em></header>
        <div class="metric-grid monitoring-metric-grid">
          ${config.metrics.map(([key, label]) => `
            <div><span>${label}</span><b>${formatNumber(metricValue(metrics, key), { currency: key === "revenue" })}</b></div>
          `).join("")}
        </div>
        <div class="overview-order-status ${orderClass}"><span>是否出单</span><b>${orderText}</b></div>
        <footer><span>${latestTime ? `最近观测 ${formatTime(latestTime)}` : "尚无后台快照"}</span><strong>进入工作台 →</strong></footer>
      </button>
    `;
  }

  function renderOverviewLowerGrid(accounts, latestMap, alerts) {
    const recentImports = state.imports.slice().sort((left, right) => new Date(right.importedAt) - new Date(left.importedAt)).slice(0, 4);
    return `
      <section class="lower-grid">
        <div class="queue-panel">
          <div class="section-heading compact"><div><span>EVIDENCE QUEUE</span><h2>最近数据接入</h2></div><a href="#data">全部记录 →</a></div>
          <div class="queue-list">
            ${recentImports.length ? recentImports.map((batch) => {
              const account = state.accounts.find((item) => item.id === batch.accountId);
              const config = PLATFORM_CONFIG[batch.platform];
              return `<article><span class="platform-tag">${config.name}</span><div><h3>${escapeHtml(batch.fileName)}</h3><p>${escapeHtml(account?.displayName || "账号已移除")} · ${batch.rowCount} 行 · 观测 ${formatTime(batch.observedAt)}</p></div><span class="state-chip ready">本地已保存</span><span>✓</span></article>`;
            }).join("") : `<div class="empty-state compact-empty"><span>NO IMPORT</span><h3>还没有本地导入</h3><p>下载模板后导入第一份真实后台数据。</p></div>`}
          </div>
        </div>
        <div class="health-panel">
          <div class="section-heading compact"><div><span>CONTROL TOWER</span><h2>操盘健康度</h2></div><a href="#alerts">查看预警 →</a></div>
          <div class="health-stack">
            <article><span>账号核验</span><b>${accounts.filter((account) => account.verifiedAt).length}/${accounts.length || 0}</b><small>负责人本地确认</small></article>
            <article><span>快照覆盖</span><b>${latestMap.size}/${accounts.length || 0}</b><small>所选范围最新快照</small></article>
            <article><span>开放预警</span><b>${alerts.length}</b><small>缺口优先于涨跌判断</small></article>
          </div>
        </div>
      </section>
    `;
  }

  function renderOperations() {
    const accounts = getScopedAccounts();
    const latestMap = getLatestSnapshotsByAccount(accounts);
    return `
      <section class="view-page">
        <header class="view-header"><div><span>PLATFORM WORKBENCH</span><h2>账号运营工作台</h2><p>逐账号查看平台原生流量、互动、出单与相邻快照变化。这里不把公开当前值冒充后台区间数据。</p></div><button class="primary-button" type="button" data-action="open-register">登记账号 ＋</button></header>
        <div class="workspace-surface">
          <div class="surface-heading"><div><h3>真实运营账号</h3><p>账号编号是导入主键；不收密码、Cookie、买家聊天或收货信息。</p></div><span>${accounts.length} 个当前范围账号</span></div>
          ${renderAccountTable(accounts)}
        </div>
        <div class="workbench-grid section-block">
          ${Object.keys(PLATFORM_CONFIG)
            .filter((platformId) => ui.platform === "all" || ui.platform === platformId)
            .map((platformId) => renderPlatformWorkbench(platformId, accounts, latestMap))
            .join("")}
        </div>
      </section>
    `;
  }

  function renderAccountTable(accounts) {
    if (!accounts.length) {
      return `<div class="empty-state"><span>ACCOUNT FIRST</span><h3>当前范围还没有账号</h3><p>先登记平台、账号编号、负责人和经营目标，再导入对应 CSV。</p><button class="primary-button empty-action" type="button" data-action="open-register">登记账号</button></div>`;
    }
    return `
      <div class="account-table">
        <div class="account-row account-head"><span>平台</span><span>账号 / 编号</span><span>负责人</span><span>经营目标</span><span>核验</span><span>最近数据</span><span>动作</span></div>
        ${accounts.map((account) => {
          const config = PLATFORM_CONFIG[account.platform];
          const latest = state.snapshots.filter((snapshot) => snapshot.accountId === account.id).sort((left, right) => new Date(right.observedAt) - new Date(left.observedAt))[0];
          const url = safeProfileUrl(account.profileUrl);
          return `
            <article class="account-row">
              <span class="account-platform"><i>${config.code}</i><b>${config.name}</b></span>
              <span><b>${escapeHtml(account.displayName)}</b><br /><small>${escapeHtml(account.accountRef)}</small>${url ? `<br /><a class="inline-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">公开主页 ↗</a>` : ""}</span>
              <span>${escapeHtml(account.owner)}</span>
              <span>${escapeHtml(account.goal)}</span>
              <span class="state-chip ${account.verifiedAt ? "ready" : "waiting"}">${account.verifiedAt ? `已核验 ${formatDate(account.verifiedAt)}` : "待核验"}</span>
              <span>${latest ? formatDate(latest.observedAt) : "待导入"}</span>
              <span class="account-actions"><button type="button" data-action="verify-account" data-account-id="${account.id}">${account.verifiedAt ? "重核" : "核验"}</button><button type="button" data-action="open-import" data-account-id="${account.id}" data-platform="${account.platform}">导入</button></span>
            </article>
          `;
        }).join("")}
        <div class="account-guidance"><b>核验边界</b><i>→</i>“本地核验”只记录负责人确认，不代表平台 OAuth 授权或自动采集成功。</div>
      </div>
    `;
  }

  function renderPlatformWorkbench(platformId, accounts, latestMap) {
    const config = PLATFORM_CONFIG[platformId];
    const platformAccounts = accounts.filter((account) => account.platform === platformId);
    const cards = platformAccounts.map((account) => renderAccountSignalCard(account, latestMap.get(account.id))).join("");
    return `
      <section class="workspace-surface ${platformAccounts.length > 1 ? "span-2" : ""}">
        <div class="surface-heading"><div><h3>${config.name} · 原生指标</h3><p>${config.metrics.map(([, label]) => label).join(" / ")}</p></div><a class="secondary-button button-link" href="${config.template}" download>下载模板</a></div>
        <div class="account-signal-list">
          ${cards || `<div class="empty-state compact-empty"><span>${config.code}</span><h3>尚未登记${config.name}账号</h3><p>登记后才能绑定 CSV 与追踪相邻快照。</p></div>`}
        </div>
      </section>
    `;
  }

  function renderAccountSignalCard(account, latest) {
    const config = PLATFORM_CONFIG[account.platform];
    if (!latest) {
      return `<article class="account-signal-card"><header><div><b>${escapeHtml(account.displayName)}</b><span>${escapeHtml(account.accountRef)}</span></div><small>尚无快照</small></header><div class="empty-state compact-empty"><span>WAITING DATA</span><h3>流量与出单均待导入</h3><p>未知不是 0，请从后台导出后再判断。</p><button class="secondary-button empty-action" type="button" data-action="open-import" data-account-id="${account.id}" data-platform="${account.platform}">导入 CSV</button></div></article>`;
    }
    const previous = getPreviousSnapshot(account.id, latest);
    const orders = metricValue(latest.metrics, config.orderKey);
    const orderClass = orders === undefined ? "pending" : orders > 0 ? "ready" : "idle";
    const orderText = orders === undefined ? "待导入" : orders > 0 ? `已出单 · ${formatNumber(orders)} 单` : "已导入 · 0 单";
    const metricItems = config.metrics.slice(0, 5);
    return `
      <article class="account-signal-card">
        <header><div><b>${escapeHtml(account.displayName)}</b><span>${escapeHtml(account.accountRef)} · ${latest.referenceCount} 个${account.platform === "xianyu" ? "商品" : "内容"}</span></div><small>观测 ${formatTime(latest.observedAt)}<br />来源 ${escapeHtml(latest.fileName)}</small></header>
        <div class="account-order-signal ${orderClass}"><div><span>是否出单</span><b>${orderText}</b></div><small>${orders === undefined ? "字段为空，不按 0 处理" : "来自同一导入批次"}</small></div>
        <div class="account-signal-metrics">
          ${metricItems.map(([key, label]) => {
            const current = metricValue(latest.metrics, key);
            const previousValue = previous ? metricValue(previous.metrics, key) : undefined;
            const change = metricChange(current, previousValue);
            return `<div><span>${label}</span><b>${formatNumber(current)}</b><small class="metric-change ${change.className}">${change.text}</small></div>`;
          }).join("")}
        </div>
        <p class="account-signal-note">相邻变化仅比较该账号最近两份快照；如时间范围或导出口径不同，请先修正数据再解释原因。</p>
      </article>
    `;
  }

  function metricChange(current, previous) {
    if (current === undefined) return { className: "pending", text: "本期待导入" };
    if (previous === undefined) return { className: "pending", text: "等待第二份同口径快照" };
    const delta = current - previous;
    if (delta > 0) return { className: "up", text: `较上次 +${formatNumber(delta)}` };
    if (delta < 0) return { className: "down", text: `较上次 ${formatNumber(delta)}` };
    return { className: "flat", text: "较上次持平" };
  }

  function renderAlerts() {
    const alerts = deriveAlerts();
    const openAlerts = alerts.filter((alert) => !alert.handled);
    const dataGapCount = openAlerts.filter((alert) => ["缺口", "时效"].includes(alert.level)).length;
    const orderGapCount = openAlerts.filter((alert) => alert.level === "经营").length;
    return `
      <section class="view-page">
        <header class="view-header"><div><span>SIGNALS & ALERTS</span><h2>信号、证据与下一动作</h2><p>预警只描述可验证事实、未知边界和下一步，不使用来源不明的“平台玄学阈值”。</p></div><button class="primary-button" type="button" data-action="open-import">补充数据 ＋</button></header>
        <div class="alert-summary">
          <article><span>开放预警</span><b>${openAlerts.length}</b><small>已处理 ${alerts.length - openAlerts.length} 项</small></article>
          <article><span>数据缺口 / 过期</span><b>${dataGapCount}</b><small>先补证据，再谈涨跌</small></article>
          <article><span>出单字段缺口</span><b>${orderGapCount}</b><small>未知不等于 0 单</small></article>
        </div>
        <div class="alert-detail-list">
          ${alerts.length ? alerts.map((alert) => renderAlertCard(alert)).join("") : `<div class="workspace-surface empty-state"><span>NO OPEN SIGNAL</span><h3>当前没有证据缺口</h3><p>继续按同账号、同字段、同时间口径导入下一份快照，系统才会生成相邻变化信号。</p></div>`}
        </div>
      </section>
    `;
  }

  function renderAlertCard(alert) {
    const config = PLATFORM_CONFIG[alert.platform];
    return `
      <article class="${alert.handled ? "handled" : ""}">
        <header><span class="platform-tag">${config.name}</span><div><small>${alert.level}信号</small><h3>${escapeHtml(alert.title)}</h3></div><em>${alert.handled ? "已处理" : "待处理"}</em></header>
        <div class="alert-evidence">
          <div><span>已知事实</span><p>${escapeHtml(alert.evidence)}</p></div>
          <div><span>未知边界</span><p>${escapeHtml(alert.uncertainty)}</p></div>
          <div><span>判断状态</span><p>${alert.handled ? "负责人已确认处理" : "证据尚未闭合"}</p></div>
          <div><span>下一动作</span><p>${escapeHtml(alert.action)}</p></div>
        </div>
        <footer>
          <button class="secondary-button" type="button" data-action="create-alert-task" data-alert-id="${escapeHtml(alert.id)}">加入任务</button>
          <button class="secondary-button" type="button" data-action="toggle-alert" data-alert-id="${escapeHtml(alert.id)}">${alert.handled ? "重新打开" : "标记已处理"}</button>
        </footer>
      </article>
    `;
  }

  function renderTasks() {
    const openTasks = state.tasks.filter((task) => task.status !== "done");
    const doneTasks = state.tasks.filter((task) => task.status === "done");
    return `
      <section class="view-page">
        <header class="view-header"><div><span>TASKS & EXPERIMENTS</span><h2>执行清单与复盘门</h2><p>任务从真实缺口或操盘判断生成。完成动作不等于动作有效，仍需下一份同口径快照验证。</p></div><button class="primary-button" type="button" data-action="open-task">新建任务 ＋</button></header>
        <div class="catalog-grid task-kpis">
          <article><span>待执行</span><b>${openTasks.length}</b><small>当前本地清单</small></article>
          <article><span>已完成</span><b>${doneTasks.length}</b><small>等待后续数据验证</small></article>
          <article><span>绑定平台</span><b>${new Set(state.tasks.map((task) => task.platform)).size}</b><small>小红书 / 抖音 / 闲鱼</small></article>
          <article><span>证据快照</span><b>${state.snapshots.length}</b><small>不是任务完成数</small></article>
        </div>
        <div class="workspace-surface">
          <div class="surface-heading"><div><h3>当前执行清单</h3><p>完成后保留记录，不自动宣称增长归因。</p></div><span>${state.tasks.length} 项</span></div>
          <div class="task-table">
            ${state.tasks.length ? state.tasks
              .slice()
              .sort((left, right) => Number(left.status === "done") - Number(right.status === "done") || new Date(right.createdAt) - new Date(left.createdAt))
              .map((task, index) => renderTaskRow(task, index)).join("") : `<div class="empty-state"><span>NO TASK</span><h3>还没有执行任务</h3><p>可以从今日关键动作、预警卡片或手工新建任务进入清单。</p><button class="primary-button empty-action" type="button" data-action="open-task">新建任务</button></div>`}
          </div>
        </div>
        <div class="workspace-surface section-block">
          <div class="surface-heading"><div><h3>动作有效性验证</h3><p>同口径快照到齐前，不把“已执行”写成“已有效”。</p></div></div>
          <div class="evidence-timeline">
            <article><b>01</b><span>记录基线</span><small>导入动作前同账号快照</small></article>
            <article><b>02</b><span>只改一项</span><small>避免多个动作同时发生</small></article>
            <article><b>03</b><span>记录执行</span><small>保留负责人和时间</small></article>
            <article><b>04</b><span>导入复测</span><small>保持字段与时间口径一致</small></article>
            <article><b>05</b><span>判断去留</span><small>证据支持才沉淀为规则</small></article>
          </div>
        </div>
      </section>
    `;
  }

  function renderTaskRow(task, index) {
    const config = PLATFORM_CONFIG[task.platform] || { name: "全部平台" };
    return `
      <article class="${task.status === "done" ? "task-done" : ""}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div><small>${config.name} · ${escapeHtml(task.source || "手工任务")}</small><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.note || "完成后导入下一份快照验证，不直接归因。")}</p></div>
        <span class="state-chip ${task.status === "done" ? "ready" : "waiting"}">${task.status === "done" ? "已完成" : "待执行"}</span>
        <button type="button" data-action="toggle-task" data-task-id="${task.id}">${task.status === "done" ? "重新打开" : "完成"}</button>
      </article>
    `;
  }

  function renderKnowledge() {
    const rules = [
      ["TRUTH-001", "空字段显示“待导入”，CSV 中明确填写的 0 保持为真实零。", "数据真实性"],
      ["SOURCE-002", "公开主页当前值不冒充后台近 7/14/30 天区间数据。", "来源边界"],
      ["XHS-003", "小红书区分图文阅读与视频观看，同时保留评论、分享/转发与订单。", "平台口径"],
      ["DY-004", "抖音监测曝光、播放、评论、分享/转发、完播与支付订单。", "平台口径"],
      ["XY-005", "闲鱼只使用曝光、浏览、想要、有效咨询、支付订单等原生经营指标，不虚构评论或转发。", "平台口径"],
      ["ORDER-006", "互动数据不能证明出单；订单必须来自电商后台或订单台账。", "经营证据"],
      ["EXPERIMENT-007", "已执行不等于有效；至少需要动作前后同账号、同字段、同口径快照。", "实验纪律"],
      ["PRIVACY-008", "禁止导入密码、Cookie、Token、买家聊天、手机号和收货地址。", "隐私安全"],
    ];
    return `
      <section class="view-page">
        <header class="view-header"><div><span>KNOWLEDGE & RULES</span><h2>操盘知识与数据纪律</h2><p>这里沉淀的是可复核的操作规则，不是来源不明的平台玄学。</p></div></header>
        <div class="catalog-grid">
          <article><span>硬规则</span><b>${rules.length}</b><small>数据、平台与隐私边界</small></article>
          <article><span>平台口径</span><b>3</b><small>小红书 / 抖音 / 闲鱼</small></article>
          <article><span>未知处理</span><b>待导入</b><small>永远不自动补 0</small></article>
          <article><span>建议动作</span><b>≤ 3</b><small>防止信息过载</small></article>
        </div>
        <div class="workspace-surface">
          <div class="surface-heading"><div><h3>已启用的操盘规则</h3><p>所有静态版页面共用这些判断边界。</p></div><span>本地版 v1</span></div>
          <div class="knowledge-rules">
            ${rules.map(([code, rule, category]) => `<article><b>${code}</b><p>${rule}</p><span>${category}</span></article>`).join("")}
          </div>
        </div>
        <div class="workspace-surface section-block">
          <div class="surface-heading"><div><h3>各平台从哪里拿数据</h3><p>下载模板后，由负责人从对应后台手工导出并按字段映射。</p></div></div>
          <div class="domain-grid">
            ${Object.values(PLATFORM_CONFIG).map((config) => `<article><span>${config.name}</span><b class="available">手工 CSV</b><p>${config.sourceLabel}<br />模板不包含账号密码或买家隐私。</p></article>`).join("")}
            <article><span>私有动态版</span><b class="available">服务端审计</b><p>多人协作、权限、审批、回滚与 D1 数据库。</p></article>
          </div>
        </div>
      </section>
    `;
  }

  function renderData() {
    const imports = state.imports.slice().sort((left, right) => new Date(right.importedAt) - new Date(left.importedAt));
    return `
      <section class="view-page">
        <header class="view-header"><div><span>DATA & GOVERNANCE</span><h2>数据接入与本地治理</h2><p>CSV 在当前浏览器解析和保存，不会提交到 GitHub。导入记录保留文件名、账号、行数、观测时间和导入时间。</p></div><button class="primary-button" type="button" data-action="open-import">导入 CSV ＋</button></header>
        <div class="data-flow">
          ${["选择平台", "绑定账号", "读取 CSV", "隐私拦截", "字段校验", "本地保存", "刷新判断"].map((label, index) => `<div><span>${index + 1}</span><b>${label}</b></div>`).join("")}
        </div>
        <div class="workspace-surface pilot-surface">
          <div class="surface-heading"><div><h3>三平台导入模板</h3><p>先登记账号，再把模板中的 account_ref 替换为完全一致的账号编号。</p></div><span>CSV · UTF-8</span></div>
          <div class="pilot-table template-table">
            <div class="pilot-row pilot-head"><span>平台</span><span>流量</span><span>互动</span><span>经营</span><span>隐私</span><span>推荐来源</span><span>模板</span></div>
            ${Object.values(PLATFORM_CONFIG).map((config) => `
              <div class="pilot-row"><b>${config.name}</b><span class="passed">✓ 原生字段</span><span class="passed">✓ 平台口径</span><span class="passed">✓ 支付订单</span><span class="passed">不含买家数据</span><em>${config.sourceLabel}</em><a href="${config.template}" download>下载 CSV</a></div>
            `).join("")}
          </div>
          <p class="pilot-note">CSV 文件上限 5 MB、单批最多 10,000 行。检测到 <code>password / cookie / token / 买家 / 地址 / chat</code> 等字段会拒绝导入。</p>
        </div>
        <div class="data-layout">
          <div class="workspace-surface">
            <div class="surface-heading"><div><h3>本地导入记录</h3><p>只代表当前浏览器已经成功保存的批次。</p></div><span>${imports.length} 批</span></div>
            <div class="source-table">
              ${imports.length ? imports.map((batch) => renderImportRow(batch)).join("") : `<div class="empty-state"><span>NO SOURCE</span><h3>还没有接入数据</h3><p>导入成功后，批次证据会显示在这里。</p></div>`}
            </div>
          </div>
          <aside class="workspace-surface local-control-panel">
            <div class="surface-heading"><div><h3>本地备份与恢复</h3><p>跨设备前先导出 JSON；GitHub 不会替你同步业务数据。</p></div></div>
            <div class="control-stack">
              <button class="secondary-button" type="button" data-action="export-backup">导出本地备份 JSON</button>
              <label class="secondary-button file-button">导入本地备份 JSON<input id="backup-file" type="file" accept="application/json,.json" /></label>
              <button class="danger-button" type="button" data-action="reset-local">清空当前浏览器数据</button>
            </div>
            <ul class="quality-list">
              <li><span>账号</span><b>${state.accounts.length}</b></li>
              <li><span>快照</span><b>${state.snapshots.length}</b></li>
              <li><span>任务</span><b>${state.tasks.length}</b></li>
              <li><span>最近本地写入</span><b>${formatTime(state.updatedAt)}</b></li>
            </ul>
            <div class="permission-note local-only-note"><b>GitHub 静态边界</b><span>本页面没有安全登录、数据库和定时采集。需要多人协作时使用私有动态版，不要把真实 CSV 提交进仓库。</span></div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderImportRow(batch) {
    const account = state.accounts.find((item) => item.id === batch.accountId);
    const config = PLATFORM_CONFIG[batch.platform];
    return `
      <article>
        <b>${config.code}</b>
        <div><span>${escapeHtml(batch.fileName)}</span><small>${escapeHtml(account?.displayName || "账号已移除")} · ${batch.rowCount} 行 / ${batch.referenceCount} 个对象</small></div>
        <span class="state-chip ready">已保存</span>
        <p>观测 ${formatTime(batch.observedAt)}<br />导入 ${formatTime(batch.importedAt)}</p>
      </article>
    `;
  }

  function openModal(type, payload = {}) {
    if (type === "import" && !state.accounts.length) {
      showToast("请先登记一个真实运营账号，再绑定 CSV。", "warning");
      type = "register";
    }
    ui.modal = type;
    ui.modalPayload = payload;
    renderModal();
    window.setTimeout(() => {
      const firstInput = modalRoot.querySelector("input:not([type='hidden']), select, textarea, button");
      firstInput?.focus();
    }, 0);
  }

  function closeModal() {
    ui.modal = null;
    ui.modalPayload = null;
    modalRoot.innerHTML = "";
  }

  function renderModal() {
    const modalRenderers = {
      register: renderRegisterModal,
      import: renderImportModal,
      task: renderTaskModal,
    };
    const content = modalRenderers[ui.modal]?.();
    modalRoot.innerHTML = content
      ? `<div class="drawer-layer" data-action="close-overlay"><section class="write-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="drawer-close" type="button" data-action="close-modal" aria-label="关闭">×</button>${content}</section></div>`
      : "";
  }

  function renderRegisterModal() {
    const defaultPlatform = ui.modalPayload?.platform || (ui.platform !== "all" ? ui.platform : "xiaohongshu");
    return `
      <span class="drawer-kicker">ACCOUNT REGISTRATION</span>
      <h2 id="modal-title">登记真实运营账号</h2>
      <p>账号编号用于绑定 CSV。请勿填写密码、Cookie、Token、买家信息或聊天内容。</p>
      <form class="write-form" id="register-form">
        <label><span>平台 *</span><select name="platform" required>${Object.entries(PLATFORM_CONFIG).map(([id, config]) => `<option value="${id}" ${id === defaultPlatform ? "selected" : ""}>${config.name}</option>`).join("")}</select></label>
        <label><span>账号编号 / 店铺编号 *</span><input name="accountRef" maxlength="120" autocomplete="off" required placeholder="与 CSV account_ref 完全一致" /></label>
        <label><span>显示名称 *</span><input name="displayName" maxlength="80" required placeholder="例：小红书品牌号 A" /></label>
        <label><span>负责人 *</span><input name="owner" maxlength="60" required placeholder="例：Harry" /></label>
        <label class="full"><span>公开主页链接（可选）</span><input name="profileUrl" type="url" maxlength="300" placeholder="https://..." /></label>
        <label class="full"><span>本阶段经营目标 *</span><textarea name="goal" maxlength="240" required placeholder="例：验证内容到咨询的转化，优先补齐订单归因"></textarea></label>
        <p class="form-message" id="register-error" hidden></p>
        <button class="primary-button full" type="submit">保存到当前浏览器</button>
      </form>
    `;
  }

  function renderImportModal() {
    const requestedAccount = state.accounts.find((account) => account.id === ui.modalPayload?.accountId);
    const defaultPlatform = requestedAccount?.platform || ui.modalPayload?.platform || (ui.platform !== "all" ? ui.platform : state.accounts[0]?.platform);
    const accounts = getPlatformAccounts(defaultPlatform);
    return `
      <span class="drawer-kicker">LOCAL CSV IMPORT</span>
      <h2 id="modal-title">导入平台后台快照</h2>
      <p>文件只在当前浏览器读取。导入前会校验主键、时间、数值、隐私字段和账号归属。</p>
      <div class="permission-note"><b>本地处理，不自动上传</b><span>空字段继续显示“待导入”；明确填写的 0 会作为真实零保存。</span></div>
      <form class="write-form" id="import-form">
        <label><span>平台 *</span><select name="platform" id="import-platform" required>${Object.entries(PLATFORM_CONFIG).map(([id, config]) => `<option value="${id}" ${id === defaultPlatform ? "selected" : ""}>${config.name}</option>`).join("")}</select></label>
        <label><span>绑定账号 *</span><select name="accountId" id="import-account" required>${renderImportAccountOptions(accounts, requestedAccount?.id)}</select></label>
        <label class="full"><span>CSV 文件 *</span><input name="file" type="file" accept="text/csv,.csv" required /></label>
        <p class="import-hint full">模板：<a id="import-template-link" href="${PLATFORM_CONFIG[defaultPlatform].template}" download>下载${PLATFORM_CONFIG[defaultPlatform].name} CSV</a> · 最大 5 MB / 10,000 行</p>
        <p class="form-message" id="import-error" hidden></p>
        <button class="primary-button full" type="submit">校验并保存本地快照</button>
      </form>
    `;
  }

  function renderImportAccountOptions(accounts, selectedId) {
    if (!accounts.length) return `<option value="">该平台尚无账号，请先登记</option>`;
    return accounts.map((account) => `<option value="${account.id}" ${account.id === selectedId ? "selected" : ""}>${escapeHtml(account.displayName)} · ${escapeHtml(account.accountRef)}</option>`).join("");
  }

  function renderTaskModal() {
    const defaultPlatform = ui.modalPayload?.platform || (ui.platform !== "all" ? ui.platform : "xiaohongshu");
    return `
      <span class="drawer-kicker">NEW EXECUTION TASK</span>
      <h2 id="modal-title">新建执行任务</h2>
      <p>把动作写清楚，但不要在完成任务时提前宣称动作有效。</p>
      <form class="write-form" id="task-form">
        <label><span>平台 *</span><select name="platform" required>${Object.entries(PLATFORM_CONFIG).map(([id, config]) => `<option value="${id}" ${id === defaultPlatform ? "selected" : ""}>${config.name}</option>`).join("")}</select></label>
        <label><span>任务来源</span><input name="source" maxlength="60" value="手工任务" /></label>
        <label class="full"><span>动作标题 *</span><input name="title" maxlength="120" required placeholder="例：补齐本周支付订单字段" /></label>
        <label class="full"><span>完成标准 / 备注</span><textarea name="note" maxlength="300" placeholder="写清楚谁在什么时间完成什么；效果由下一份同口径快照验证"></textarea></label>
        <p class="form-message" id="task-error" hidden></p>
        <button class="primary-button full" type="submit">加入执行清单</button>
      </form>
    `;
  }

  function showFormError(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastRoot.append(toast);
    window.setTimeout(() => toast.classList.add("visible"), 10);
    window.setTimeout(() => {
      toast.classList.remove("visible");
      window.setTimeout(() => toast.remove(), 180);
    }, 3200);
  }

  function navigateTo(view) {
    window.location.hash = view;
    if (ui.view === view) render();
  }

  function addTaskFromRecommendation(sourceId) {
    if (state.tasks.some((task) => task.sourceId === sourceId)) return;
    const recommendation = deriveRecommendations().find((item) => item.id === sourceId);
    if (!recommendation) {
      showToast("该建议已更新，请刷新后重试。", "warning");
      return;
    }
    state.tasks.push({
      id: createId("task"),
      platform: recommendation.platform,
      title: recommendation.title,
      note: recommendation.reason,
      source: recommendation.source,
      sourceId: recommendation.id,
      status: "open",
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    persistState();
    render();
    showToast("已加入执行清单。完成后仍需下一份快照验证效果。");
  }

  function addTaskFromAlert(alertId) {
    const sourceId = `alert:${alertId}`;
    if (state.tasks.some((task) => task.sourceId === sourceId)) {
      showToast("该预警已经生成任务。", "warning");
      return;
    }
    const alert = deriveAlerts().find((item) => item.id === alertId);
    if (!alert) return;
    state.tasks.push({
      id: createId("task"),
      platform: alert.platform,
      title: alert.title,
      note: alert.action,
      source: "预警转任务",
      sourceId,
      status: "open",
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    persistState();
    render();
    showToast("预警已加入执行清单。", "success");
  }

  function verifyAccount(accountId) {
    const account = state.accounts.find((item) => item.id === accountId);
    if (!account) return;
    account.verifiedAt = new Date().toISOString();
    persistState();
    render();
    showToast(`已记录 ${account.displayName} 的本地核验时间。`);
  }

  function toggleAlert(alertId) {
    const index = state.handledAlerts.indexOf(alertId);
    if (index >= 0) state.handledAlerts.splice(index, 1);
    else state.handledAlerts.push(alertId);
    persistState();
    render();
  }

  function toggleTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    task.status = task.status === "done" ? "open" : "done";
    task.completedAt = task.status === "done" ? new Date().toISOString() : null;
    persistState();
    render();
    showToast(task.status === "done" ? "任务已完成；等待后续快照验证效果。" : "任务已重新打开。");
  }

  function exportBackup() {
    const payload = {
      ...state,
      exportedAt: new Date().toISOString(),
      exportSource: "three-platform-ops-center-github-local",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `three-platform-ops-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("本地备份已导出。请妥善保管业务数据。", "success");
  }

  function sanitizeBackup(payload) {
    if (!payload || payload.version !== 1) throw new Error("备份版本不受支持。");
    const arrays = ["accounts", "snapshots", "imports", "tasks", "handledAlerts"];
    arrays.forEach((key) => {
      if (!Array.isArray(payload[key])) throw new Error(`备份缺少 ${key} 数组。`);
    });
    if (payload.accounts.length > 1000 || payload.snapshots.length > 10000 || payload.tasks.length > 10000) {
      throw new Error("备份记录数超过本地版安全上限。");
    }
    payload.accounts.forEach((account) => {
      if (!PLATFORM_CONFIG[account.platform] || !account.id || !account.accountRef || !account.displayName) {
        throw new Error("备份中存在无效账号记录。");
      }
    });
    payload.snapshots.forEach((snapshot) => {
      if (!PLATFORM_CONFIG[snapshot.platform] || !snapshot.id || !snapshot.accountId || !snapshot.metrics) {
        throw new Error("备份中存在无效快照记录。");
      }
    });
    return {
      ...createDefaultState(),
      version: 1,
      accounts: payload.accounts,
      snapshots: payload.snapshots,
      imports: payload.imports,
      tasks: payload.tasks,
      handledAlerts: payload.handledAlerts.filter((item) => typeof item === "string"),
      updatedAt: new Date().toISOString(),
    };
  }

  appElement.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;

    if (action === "open-register") openModal("register", { platform: trigger.dataset.platform });
    else if (action === "open-import") openModal("import", { platform: trigger.dataset.platform, accountId: trigger.dataset.accountId });
    else if (action === "open-task") openModal("task", { platform: trigger.dataset.platform });
    else if (action === "go-alerts") navigateTo("alerts");
    else if (action === "go-data") navigateTo("data");
    else if (action === "go-tasks") navigateTo("tasks");
    else if (action === "verify-account") verifyAccount(trigger.dataset.accountId);
    else if (action === "toggle-alert") toggleAlert(trigger.dataset.alertId);
    else if (action === "toggle-task") toggleTask(trigger.dataset.taskId);
    else if (action === "create-alert-task") addTaskFromAlert(trigger.dataset.alertId);
    else if (action === "create-recommendation-task") addTaskFromRecommendation(trigger.dataset.sourceId);
    else if (action === "select-route") {
      ui.routePlatform = trigger.dataset.platform;
      render();
    } else if (action === "route-next") {
      const platformId = trigger.dataset.platform;
      ui.platform = platformId;
      ui.account = "all";
      const readiness = platformReadiness(platformId);
      if (readiness.stage < 2) openModal("register", { platform: platformId });
      else navigateTo("operations");
    } else if (action === "open-platform") {
      ui.platform = trigger.dataset.platform;
      ui.account = "all";
      navigateTo("operations");
    } else if (action === "export-backup") {
      exportBackup();
    } else if (action === "reset-local") {
      const confirmed = window.confirm("确认清空当前浏览器中的账号、快照、导入记录和任务吗？此操作无法撤销，建议先导出备份。");
      if (!confirmed) return;
      state = createDefaultState();
      window.localStorage.removeItem(STORAGE_KEY);
      ui.platform = "all";
      ui.account = "all";
      render();
      showToast("当前浏览器数据已清空。", "warning");
    }
  });

  appElement.addEventListener("change", async (event) => {
    if (event.target.id === "platform-filter") {
      ui.platform = event.target.value;
      ui.account = "all";
      render();
    } else if (event.target.id === "account-filter") {
      ui.account = event.target.value;
      render();
    } else if (event.target.id === "period-filter") {
      ui.period = event.target.value;
      render();
    } else if (event.target.id === "backup-file") {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        showToast("备份文件超过 5 MB，已拒绝读取。", "error");
        return;
      }
      try {
        const payload = JSON.parse(await file.text());
        const nextState = sanitizeBackup(payload);
        const confirmed = window.confirm(`将用备份中的 ${nextState.accounts.length} 个账号、${nextState.snapshots.length} 个快照替换当前浏览器数据。是否继续？`);
        if (!confirmed) return;
        state = nextState;
        persistState();
        ui.platform = "all";
        ui.account = "all";
        render();
        showToast("本地备份已恢复。", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "备份文件无法读取。", "error");
      } finally {
        event.target.value = "";
      }
    }
  });

  modalRoot.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    if (trigger.dataset.action === "close-modal") closeModal();
    if (trigger.dataset.action === "close-overlay" && event.target === trigger) closeModal();
  });

  modalRoot.addEventListener("change", (event) => {
    if (event.target.id !== "import-platform") return;
    const platformId = event.target.value;
    const accountSelect = document.getElementById("import-account");
    const templateLink = document.getElementById("import-template-link");
    accountSelect.innerHTML = renderImportAccountOptions(getPlatformAccounts(platformId));
    templateLink.href = PLATFORM_CONFIG[platformId].template;
    templateLink.textContent = `下载${PLATFORM_CONFIG[platformId].name} CSV`;
  });

  modalRoot.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.id === "register-form") handleRegisterSubmit(event.target);
    else if (event.target.id === "import-form") await handleImportSubmit(event.target);
    else if (event.target.id === "task-form") handleTaskSubmit(event.target);
  });

  function handleRegisterSubmit(form) {
    const formData = new FormData(form);
    const platform = String(formData.get("platform") || "");
    const accountRef = String(formData.get("accountRef") || "").trim();
    const displayName = String(formData.get("displayName") || "").trim();
    const owner = String(formData.get("owner") || "").trim();
    const profileUrl = String(formData.get("profileUrl") || "").trim();
    const goal = String(formData.get("goal") || "").trim();
    if (!PLATFORM_CONFIG[platform] || !accountRef || !displayName || !owner || !goal) {
      showFormError("register-error", "请填写全部必填字段。");
      return;
    }
    if (/[\r\n]/.test(accountRef) || accountRef.length > 120) {
      showFormError("register-error", "账号编号不能包含换行，且最多 120 个字符。");
      return;
    }
    if (state.accounts.some((account) => account.platform === platform && account.accountRef === accountRef)) {
      showFormError("register-error", "该平台已登记相同账号编号。");
      return;
    }
    if (profileUrl && !safeProfileUrl(profileUrl)) {
      showFormError("register-error", "公开主页链接必须是有效的 http 或 https 地址。");
      return;
    }
    const account = {
      id: createId("account"),
      platform,
      accountRef,
      displayName,
      owner,
      profileUrl,
      goal,
      createdAt: new Date().toISOString(),
      verifiedAt: null,
    };
    state.accounts.push(account);
    if (!persistState()) return;
    closeModal();
    ui.platform = platform;
    ui.account = account.id;
    render();
    showToast("账号已保存到当前浏览器。下一步请核验并导入快照。", "success");
  }

  async function handleImportSubmit(form) {
    const submitButton = form.querySelector("button[type='submit']");
    const formData = new FormData(form);
    const platformId = String(formData.get("platform") || "");
    const accountId = String(formData.get("accountId") || "");
    const file = formData.get("file");
    const account = state.accounts.find((item) => item.id === accountId && item.platform === platformId);
    if (!PLATFORM_CONFIG[platformId] || !account) {
      showFormError("import-error", "请选择与平台匹配的已登记账号。");
      return;
    }
    if (!(file instanceof File) || !file.name) {
      showFormError("import-error", "请选择 CSV 文件。");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showFormError("import-error", "CSV 超过 5 MB，已拒绝读取。");
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = "正在本地校验…";
    try {
      const csv = parseCsv(await file.text());
      const snapshot = buildSnapshotFromCsv({ platformId, account, fileName: file.name, csv });
      const batch = {
        id: createId("import"),
        snapshotId: snapshot.id,
        accountId: account.id,
        platform: platformId,
        fileName: file.name,
        rowCount: snapshot.rowCount,
        referenceCount: snapshot.referenceCount,
        observedAt: snapshot.observedAt,
        importedAt: snapshot.importedAt,
      };
      state.snapshots.push(snapshot);
      state.imports.push(batch);
      if (!persistState()) {
        state.snapshots.pop();
        state.imports.pop();
        return;
      }
      closeModal();
      ui.platform = platformId;
      ui.account = account.id;
      render();
      showToast(`已保存 ${snapshot.rowCount} 行数据；空字段继续保持“待导入”。`, "success");
    } catch (error) {
      showFormError("import-error", error instanceof Error ? error.message : "CSV 导入失败。");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "校验并保存本地快照";
    }
  }

  function handleTaskSubmit(form) {
    const formData = new FormData(form);
    const platform = String(formData.get("platform") || "");
    const title = String(formData.get("title") || "").trim();
    const source = String(formData.get("source") || "手工任务").trim();
    const note = String(formData.get("note") || "").trim();
    if (!PLATFORM_CONFIG[platform] || !title) {
      showFormError("task-error", "请选择平台并填写动作标题。");
      return;
    }
    state.tasks.push({
      id: createId("task"),
      platform,
      title,
      source: source || "手工任务",
      note,
      sourceId: null,
      status: "open",
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    if (!persistState()) return;
    closeModal();
    render();
    showToast("任务已加入当前浏览器的执行清单。", "success");
  }

  window.addEventListener("hashchange", () => {
    ui.view = readViewFromHash();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ui.modal) closeModal();
    if (event.key !== "Tab" || !ui.modal) return;
    const focusable = [...modalRoot.querySelectorAll("button, input, select, textarea, a[href]")]
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (!window.location.hash) window.history.replaceState(null, "", "#overview");
  render();
})();


