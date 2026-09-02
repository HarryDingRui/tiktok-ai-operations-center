/* ==========================================================================
 * TikTok AI 智能运营中控台 v3.1 — 扩展模块
 * 1) 商品数据预警：商品 ID 搜索 → 近7天 GMV/曝光/CTR/CVR 趋势图
 * 2) 达人 BD：时间轴 + 近7天 TOP10 达人榜
 * 3) 广告投放：时间轴 + 智能分析调整事项 + 优质达人素材库（数据表+视频双通道）
 * 4) 自营短视频：GMV账号榜 / 播放量账号榜 / 单条视频播放榜 + 时间轴
 * 5) 通用自适应表格解析：不限定模板，列名模糊匹配 + 指认记忆
 * 原则：店铺导出什么就传什么；缺字段显示"待导入"，绝不编数据。
 * ========================================================================== */
(function () {
  "use strict";

  const bridge = window.OPS_BRIDGE;
  if (!bridge) {
    console.warn("OPS_BRIDGE 未就绪，扩展模块跳过初始化");
    return;
  }

  const {
    formatMoney, formatNumber, formatPercent, formatCompact,
    escapeHtml, isDateKey, addDays, parseNumber, normalizeHeaderText, parseDateCell,
  } = bridge;

  /* ================= 扩展数据集：本地存储 ================= */
  const EXTRA_DATA_KEY = "ops-extra-data-v1";
  const DATABASE_NAME = "tiktok-ai-operations-center";
  const DATABASE_STORE = "datasets";
  const VIDEO_DB_NAME = "tiktok-ops-assets";
  const VIDEO_DB_STORE = "videos";

  let extraData = { creators: [], ads: [], videos: [], assets: [] };

  function openDb(name, store) {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(name, name === VIDEO_DB_NAME ? 1 : 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("无法打开本地存储"));
    });
  }

  async function loadExtraData() {
    if (window.localStorage.getItem("tiktok-real-data-state-v4") === "cleared") return;
    try {
      const db = await openDb(DATABASE_NAME, DATABASE_STORE);
      const row = await new Promise((resolve, reject) => {
        const tx = db.transaction(DATABASE_STORE, "readonly");
        const req = tx.objectStore(DATABASE_STORE).get(EXTRA_DATA_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (row && typeof row === "object") {
        extraData = {
          creators: Array.isArray(row.creators) ? row.creators : [],
          ads: Array.isArray(row.ads) ? row.ads : [],
          videos: Array.isArray(row.videos) ? row.videos : [],
          assets: Array.isArray(row.assets) ? row.assets : [],
        };
      }
    } catch (error) {
      console.warn("读取扩展数据失败", error);
    }
  }

  async function saveExtraData() {
    try {
      const db = await openDb(DATABASE_NAME, DATABASE_STORE);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DATABASE_STORE, "readwrite");
        tx.objectStore(DATABASE_STORE).put(extraData, EXTRA_DATA_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.warn("保存扩展数据失败", error);
      window.alert("❌ 扩展数据保存失败\n\n" + (error.message || "浏览器存储不可用"));
    }
  }

  async function saveVideoBlob(file) {
    const db = await openDb(VIDEO_DB_NAME, VIDEO_DB_STORE);
    await new Promise((resolve, reject) => {
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
    } catch (error) {
      return null;
    }
  }

  /* ================= 通用自适应表格解析 ================= */
  // 每个数据集的字段同义词库（normalizeHeaderText 后匹配）
  const DATASET_SPECS = {
    creators: {
      label: "达人合作表",
      learnedKey: "tiktok-header-mapping-creators",
      required: ["date", "creator"],
      fields: {
        date: ["日期", "date", "day", "统计日期", "数据日期", "时间"],
        creator: ["达人", "达人昵称", "达人账号", "达人名称", "creator", "creator name", "influencer", "账号", "昵称", "handle", "达人handle", "kol"],
        store: ["店铺", "店铺名称", "shop", "shop name", "store", "store name"],
        status: ["状态", "合作状态", "status", "跟进状态", "交付状态"],
        gmv: ["gmv", "成交额", "销售额", "合作gmv", "达人gmv", "成交金额"],
        videos: ["视频数", "交付视频数", "视频数量", "videos", "video count", "发布视频数", "交付数量", "视频条数"],
        views: ["播放量", "播放", "views", "播放次数", "video views", "播放数"],
        note: ["备注", "note", "remark", "跟进记录", "说明"],
      },
    },
    ads: {
      label: "广告数据表",
      learnedKey: "tiktok-header-mapping-ads",
      required: ["date", "plan"],
      fields: {
        date: ["日期", "date", "day", "统计日期", "数据日期", "时间"],
        plan: ["计划", "计划id", "计划名称", "campaign", "campaign id", "campaign name", "广告计划", "ad plan", "plan id", "广告系列"],
        group: ["广告组", "ad group", "adgroup", "广告组名称", "ad set", "adset"],
        productId: ["商品id", "product id", "item id", "商品", "商品编号", "pid"],
        spend: ["消耗", "花费", "spend", "cost", "费用", "消耗金额", "广告消耗", "支出"],
        impressions: ["曝光", "impressions", "曝光量", "曝光次数", "展示量", "展示"],
        clicks: ["点击", "clicks", "点击量", "点击次数"],
        ctr: ["ctr", "点击率", "click-through rate", "click through rate"],
        cvr: ["cvr", "转化率", "conversion rate", "成交转化率"],
        gmv: ["gmv", "成交额", "销售额", "成交金额", "转化金额", "广告gmv"],
        roas: ["roas", "roi", "投产比", "广告投产比"],
        status: ["状态", "status", "计划状态", "投放状态"],
      },
    },
    videos: {
      label: "自营短视频表",
      learnedKey: "tiktok-header-mapping-videos",
      required: ["date", "account"],
      fields: {
        date: ["日期", "date", "day", "统计日期", "数据日期", "发布时间", "发布日期", "publish date", "publish time", "时间"],
        account: ["账号", "账号名称", "自营账号", "account", "account name", "发布账号", "账号昵称", "达人账号", "author"],
        videoId: ["视频id", "video id", "videoid", "视频链接", "视频", "video", "video url", "content id", "视频编号", "链接"],
        productId: ["商品id", "product id", "item id", "商品", "商品编号", "挂车商品", "pid"],
        views: ["播放量", "播放", "views", "播放次数", "video views", "播放数", "播放总量"],
        gmv: ["gmv", "成交额", "销售额", "成交金额", "视频gmv"],
        likes: ["点赞", "likes", "点赞数", "点赞量"],
        comments: ["评论", "comments", "评论数", "评论量"],
      },
    },
    assets: {
      label: "优质达人素材表",
      learnedKey: "tiktok-header-mapping-assets",
      required: ["creator"],
      fields: {
        creator: ["达人", "达人昵称", "达人账号", "creator", "creator name", "influencer", "账号", "昵称", "kol"],
        videoUrl: ["视频链接", "视频", "video", "video url", "链接", "url", "文件名", "file", "filename", "素材链接", "素材"],
        productId: ["商品id", "product id", "item id", "商品", "商品编号", "pid"],
        views: ["播放量", "播放", "views", "播放次数", "播放数"],
        gmv: ["gmv", "成交额", "销售额", "成交金额", "素材gmv"],
        roas: ["roas", "roi", "投产比", "素材roas"],
        tags: ["标签", "tags", "tag", "素材标签", "类型", "分类"],
        note: ["备注", "note", "remark", "说明"],
      },
    },
  };

  function readDatasetMapping(learnedKey) {
    try {
      return JSON.parse(window.localStorage.getItem(learnedKey) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function saveDatasetMapping(learnedKey, rawHeader, fieldKey) {
    const mappings = readDatasetMapping(learnedKey);
    mappings[normalizeHeaderText(rawHeader)] = fieldKey;
    try {
      window.localStorage.setItem(learnedKey, JSON.stringify(mappings));
    } catch (error) {
      console.warn("保存字段映射失败", error);
    }
  }

  // 在表头中为每个字段找列：先记忆映射，再同义词；每列最多被一个字段占用
  function matchDatasetColumns(headers, spec) {
    const learned = readDatasetMapping(spec.learnedKey);
    const normalizedHeaders = headers.map((header) => normalizeHeaderText(header));
    const used = new Set();
    const map = {};
    Object.keys(spec.fields).forEach((fieldKey) => {
      let found = -1;
      normalizedHeaders.forEach((normalized, index) => {
        if (found >= 0 || used.has(index)) return;
        if (learned[normalized] === fieldKey) found = index;
      });
      if (found < 0) {
        const synonyms = spec.fields[fieldKey].map((item) => normalizeHeaderText(item));
        normalizedHeaders.forEach((normalized, index) => {
          if (found >= 0 || used.has(index)) return;
          if (synonyms.includes(normalized)) found = index;
        });
      }
      if (found >= 0) {
        used.add(found);
        map[fieldKey] = found;
      }
    });
    const usedIndices = new Set(Object.values(map));
    const unmatchedHeaders = headers
      .map((header, index) => ({ raw: String(header ?? "").trim(), index }))
      .filter((item) => item.raw && !usedIndices.has(item.index));
    return { map, unmatchedHeaders, missing: Object.keys(spec.fields).filter((key) => map[key] == null) };
  }

  async function parseDatasetFile(file, datasetKey) {
    const spec = DATASET_SPECS[datasetKey];
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
      : window.XLSX.read(buffer, { type: "array", cellText: true, cellDates: true });
    // 在所有 sheet 中找匹配度最高的表头行
    let best = null;
    workbook.SheetNames.forEach((sheetName) => {
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });
      rows.slice(0, 10).forEach((row, rowIndex) => {
        const headers = row.map((cell) => String(cell ?? "").trim());
        const matched = matchDatasetColumns(headers, spec);
        const score = Object.keys(matched.map).length;
        if (!best || score > best.score) {
          best = { sheetName, rows, rowIndex, headers, matched, score };
        }
      });
    });
    if (!best || best.score < 2) {
      throw new Error(`${file.name}：未能识别表头（至少需要匹配 2 个字段，如 日期/达人/账号/计划）。检测到的首行列名：${best ? best.headers.filter(Boolean).slice(0, 8).join("、") : "空"}`);
    }
    const { rows, rowIndex, headers, matched } = best;
    const dataRows = rows.slice(rowIndex + 1).filter((row) => row.some((cell) => cell != null && cell !== ""));
    // 日期：优先行内日期列；整表没有日期列时，从文件名推断，推断不到再问一次（适用整表同一日期）
    const fileDate = parseDateCell((String(file.name).match(/(20\d{2})[-_.年]?(\d{2})[-_.月]?(\d{2})/) || [])[0]) || "";
    const parsed = dataRows.map((row) => {
      const record = { _sourceFile: file.name };
      Object.entries(matched.map).forEach(([fieldKey, columnIndex]) => {
        const raw = row[columnIndex];
        if (fieldKey === "date") record.date = parseDateCell(raw) || "";
        else if (["gmv", "videos", "views", "spend", "impressions", "clicks", "ctr", "cvr", "roas", "likes", "comments"].includes(fieldKey)) record[fieldKey] = parseNumber(raw);
        else record[fieldKey] = raw == null ? "" : String(raw).trim();
      });
      if (!record.date && fileDate) record.date = fileDate;
      return record;
    }).filter((record) => Object.values(matched.map).length && Object.keys(record).length > 2);
    if (!parsed.length) throw new Error(`${file.name}：没有可识别的数据行`);
    // 必要字段校验
    const missingRequired = spec.required.filter((key) => matched.map[key] == null);
    if (missingRequired.length) {
      throw new Error(`${file.name}：缺少必要字段「${missingRequired.map((key) => spec.fields[key][0]).join("、")}」。请在导入后的指认面板手动指定列。`);
    }
    return { records: parsed, headers, matched, fileName: file.name, rowCount: parsed.length };
  }

  /* ================= 导入处理（含指认面板） ================= */
  const pendingMappings = []; // {datasetKey, rawHeader}

  function renderDatasetMappingPanel() {
    const container = document.getElementById("import-mapping-panel");
    if (!container) return;
    if (!pendingMappings.length) return;
    const unique = [...new Map(pendingMappings.map((item) => [`${item.datasetKey}::${item.rawHeader}`, item])).values()];
    const rows = unique.map((item) => {
      const spec = DATASET_SPECS[item.datasetKey];
      const options = Object.entries(spec.fields).map(([fieldKey, synonyms]) => `<option value="${escapeHtml(fieldKey)}">${escapeHtml(synonyms[0])}</option>`).join("");
      return `<tr>
        <td><span class="tag tag-blue">${escapeHtml(spec.label)}</span> <strong>${escapeHtml(item.rawHeader)}</strong></td>
        <td><select class="mapping-select" data-dataset="${escapeHtml(item.datasetKey)}" data-raw="${escapeHtml(item.rawHeader)}">
          <option value="">暂不处理</option>
          <option value="__ignore__">忽略此列（不再提示）</option>
          ${options}
        </select></td>
      </tr>`;
    }).join("");
    container.innerHTML = `<div class="mapping-panel">
      <div class="mapping-panel-title">🧭 新导入的数据表有未识别列 —— 指认一次，系统永久记住</div>
      <div style="font-size:12px;color:#92400e;margin-bottom:8px;">左边是文件原始列名（标注了所属表类型），右边选择它对应的字段。不认得就选"忽略此列"，不影响其他数据。</div>
      <div style="overflow-x:auto;"><table class="desktop-table" style="background:#fff;">
        <thead><tr><th style="width:45%;">原始列名</th><th>对应字段</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button type="button" class="btn btn-primary" id="apply-dataset-mapping">应用映射（下次导入生效）</button>
        <button type="button" class="btn" id="dismiss-dataset-mapping">暂不处理</button>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#92400e;">提示：映射保存后，重新导入一次该文件即可按新映射解析；已导入的数据不受影响。</div>
    </div>`;
    const dismiss = container.querySelector("#dismiss-dataset-mapping");
    if (dismiss) dismiss.addEventListener("click", () => { pendingMappings.length = 0; container.innerHTML = ""; });
    const apply = container.querySelector("#apply-dataset-mapping");
    if (apply) apply.addEventListener("click", () => {
      let applied = 0;
      container.querySelectorAll("select[data-dataset]").forEach((select) => {
        if (!select.value) return;
        const spec = DATASET_SPECS[select.getAttribute("data-dataset")];
        if (!spec) return;
        if (select.value === "__ignore__") {
          saveDatasetMapping(spec.learnedKey, select.getAttribute("data-raw"), "__ignore__");
        } else {
          saveDatasetMapping(spec.learnedKey, select.getAttribute("data-raw"), select.value);
        }
        applied += 1;
      });
      pendingMappings.length = 0;
      container.innerHTML = "";
      window.alert(applied ? `✅ 已记住 ${applied} 条字段映射\n\n重新导入对应文件即可按新映射解析。` : "未选择任何映射");
    });
  }

  function rowKeyFor(datasetKey, record) {
    if (datasetKey === "creators") return `${record.date}|${record.creator}|${record.store || ""}`;
    if (datasetKey === "ads") return `${record.date}|${record.plan}|${record.group || ""}`;
    if (datasetKey === "videos") return `${record.date}|${record.account}|${record.videoId || ""}`;
    return `${record.creator}|${record.videoUrl || ""}`;
  }

  async function handleDatasetImport(event, datasetKey, statusId, onDone) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const status = document.getElementById(statusId);
    const setStatus = (text, kind) => {
      if (!status) return;
      status.className = `tag ${kind === "error" ? "tag-red" : kind === "warn" ? "tag-yellow" : "tag-green"}`;
      status.textContent = text;
    };
    setStatus(`正在解析 ${files.length} 个文件…`, "warn");
    try {
      const results = [];
      for (const file of files) {
        results.push(await parseDatasetFile(file, datasetKey));
      }
      // 缺日期的记录统一询问一次
      const lacksDate = DATASET_SPECS[datasetKey].required.includes("date") && results.some((result) => result.records.some((record) => !record.date));
      if (lacksDate) {
        const input = window.prompt("部分记录没有识别到日期。\n\n如果这些文件是同一天的数据，请输入日期（YYYY-MM-DD），留空则保留原样：", "");
        if (input && isDateKey(input.trim())) {
          results.forEach((result) => result.records.forEach((record) => { if (!record.date) record.date = input.trim(); }));
        }
      }
      // 合并：同键覆盖
      const merged = new Map(extraData[datasetKey].map((record) => [rowKeyFor(datasetKey, record), record]));
      let added = 0;
      results.forEach((result) => {
        result.records.forEach((record) => {
          merged.set(rowKeyFor(datasetKey, record), record);
          added += 1;
        });
        result.matched.unmatchedHeaders.forEach((item) => {
          const learned = readDatasetMapping(DATASET_SPECS[datasetKey].learnedKey);
          if (learned[normalizeHeaderText(item.raw)] === "__ignore__") return;
          pendingMappings.push({ datasetKey, rawHeader: item.raw });
        });
      });
      extraData[datasetKey] = [...merged.values()];
      await saveExtraData();
      window.localStorage.setItem("tiktok-real-data-state-v4", "imported");
      window.dispatchEvent(new CustomEvent("real-data-imported"));
      renderDatasetMappingPanel();
      setStatus(`已导入 ${added} 条 · 累计 ${extraData[datasetKey].length} 条`, "success");
      window.alert(`✅ ${DATASET_SPECS[datasetKey].label}导入完成\n\n${results.map((result) => `${result.fileName}：${result.rowCount} 行`).join("\n")}\n\n${pendingMappings.length ? "有未识别的列，请到「数据接入」页顶部黄色面板指认一次。" : "字段全部自动识别。"}`);
      if (typeof onDone === "function") onDone();
      renderAllExtensions();
      bridge.renderPriorityPanel();
    } catch (error) {
      setStatus("导入失败", "error");
      window.alert(`❌ 导入失败\n\n${error.message || "无法识别该文件"}`);
    } finally {
      event.target.value = "";
    }
  }

  /* ================= 工具：时间轴与图表 ================= */
  function datasetDates(datasetKey) {
    return [...new Set(extraData[datasetKey].map((record) => record.date).filter(isDateKey))].sort();
  }

  function makeRangeState(prefix, datasetKey) {
    const state = { mode: "7", start: "", end: "" };
    const bar = document.getElementById(`${prefix}-timeline`);
    if (!bar) return state;
    const startInput = document.getElementById(`${prefix}-date-start`);
    const endInput = document.getElementById(`${prefix}-date-end`);
    const chips = [...bar.querySelectorAll(".ops-chip")];
    const syncInputs = () => {
      const dates = datasetDates(datasetKey);
      const custom = state.mode === "custom";
      if (startInput) startInput.style.display = custom ? "" : "none";
      if (endInput) endInput.style.display = custom ? "" : "none";
      if (!custom) {
        if (startInput) startInput.value = "";
        if (endInput) endInput.value = "";
      } else if (dates.length) {
        if (startInput && !startInput.value) { startInput.min = dates[0]; startInput.max = dates[dates.length - 1]; startInput.value = dates[0]; }
        if (endInput && !endInput.value) { endInput.min = dates[0]; endInput.max = dates[dates.length - 1]; endInput.value = dates[dates.length - 1]; }
      }
    };
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((item) => item.classList.remove("active"));
        chip.classList.add("active");
        state.mode = chip.getAttribute(`data-${prefix}-range`) || "7";
        syncInputs();
        renderAllExtensions();
      });
    });
    [startInput, endInput].forEach((input) => {
      if (input) input.addEventListener("change", () => renderAllExtensions());
    });
    syncInputs();
    state.getBounds = () => {
      const dates = datasetDates(datasetKey);
      if (!dates.length) return { start: "", end: "" };
      if (state.mode === "all") return { start: dates[0], end: dates[dates.length - 1] };
      if (state.mode === "custom") {
        const start = startInput && isDateKey(startInput.value) ? startInput.value : dates[0];
        const end = endInput && isDateKey(endInput.value) ? endInput.value : dates[dates.length - 1];
        return start <= end ? { start, end } : { start: end, end: start };
      }
      const days = Number(state.mode) || 7;
      const end = dates[dates.length - 1];
      return { start: addDays(end, -(days - 1)), end };
    };
    state.inputs = { startInput, endInput };
    return state;
  }

  function recordsInRange(datasetKey, bounds) {
    return extraData[datasetKey].filter((record) => {
      if (!isDateKey(record.date)) return !bounds.start; // 无日期记录仅在全部数据都没有日期时展示
      if (!bounds.start) return true;
      return record.date >= bounds.start && record.date <= bounds.end;
    });
  }

  function emptyBlock(html) {
    return `<div class="ops-empty">${html}</div>`;
  }

  // 简洁 SVG 折线图
  function sparkChart(points, color) {
    const valid = points.filter((point) => point.value != null);
    if (valid.length < 2) return `<div style="font-size:12px;color:#94a3b8;padding:18px 0;text-align:center;">快照不足，至少需要 2 个日期才能画趋势</div>`;
    const width = 320;
    const height = 110;
    const padX = 8;
    const padTop = 14;
    const padBottom = 20;
    const values = valid.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = (width - padX * 2) / (valid.length - 1);
    const coords = valid.map((point, index) => [padX + index * stepX, padTop + (1 - (point.value - min) / span) * (height - padTop - padBottom)]);
    const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const dots = coords.map(([x, y], index) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${color}"><title>${valid[index].date}: ${valid[index].text}</title></circle>`).join("");
    const labels = valid.map((point, index) => {
      if (valid.length > 4 && index % Math.ceil(valid.length / 4) !== 0 && index !== valid.length - 1) return "";
      return `<text x="${coords[index][0].toFixed(1)}" y="${height - 6}" font-size="8" fill="#94a3b8" text-anchor="middle">${point.date.slice(5)}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${width} ${height}" role="img">
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${labels}
    </svg>`;
  }

  /* ================= 1. 商品数据预警：商品 ID 搜索 → 近7天趋势 ================= */
  function collectProductTrend(productId) {
    const data = bridge.getData();
    if (!data || !Array.isArray(data.stores)) return [];
    const byDate = new Map();
    let productName = "";
    let storeName = "";
    data.stores.forEach((store) => {
      (store.snapshots || []).forEach((snapshot) => {
        if (!isDateKey(snapshot.reportDate)) return;
        const product = (snapshot.products || []).find((item) => item.id === productId);
        if (!product) return;
        productName = product.name || productName;
        storeName = store.name;
        const point = byDate.get(snapshot.reportDate) || { date: snapshot.reportDate, gmv: 0, exposure: 0, clicks: 0, skuOrders: 0, orders: 0, hasGmv: false, hasExposure: false };
        if (product.gmv != null) { point.gmv += product.gmv; point.hasGmv = true; }
        if (product.exposure != null) { point.exposure += product.exposure; point.hasExposure = true; }
        if (product.clicks != null) point.clicks += product.clicks;
        if (product.skuOrders != null) point.skuOrders += product.skuOrders;
        if (product.orders != null) point.orders += product.orders;
        byDate.set(snapshot.reportDate, point);
      });
    });
    const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
    return { points, productName, storeName };
  }

  function renderProductTrend(productId) {
    const panel = document.getElementById("product-trend-panel");
    if (!panel) return;
    const { points, productName, storeName } = collectProductTrend(productId);
    if (!points.length) {
      panel.style.display = "none";
      return;
    }
    const metric = (getValue, format) => points.map((point) => {
      const value = getValue(point);
      return { date: point.date, value, text: value == null ? "待导入" : format(value) };
    });
    const series = {
      gmv: metric((point) => (point.hasGmv ? point.gmv : null), (value) => formatMoney(value)),
      exposure: metric((point) => (point.hasExposure ? point.exposure : null), (value) => formatCompact(value)),
      ctr: metric((point) => (point.hasExposure && point.exposure ? point.clicks / point.exposure * 100 : null), (value) => `${value.toFixed(2)}%`),
      cvr: metric((point) => (point.clicks ? point.orders / point.clicks * 100 : null), (value) => `${value.toFixed(2)}%`),
    };
    const latest = points[points.length - 1];
    const chartCard = (title, serie, color, latestText) => `<div class="mini-chart-card">
      <div class="mini-chart-title"><span>${title}</span><span>${latestText}</span></div>
      ${sparkChart(serie, color)}
    </div>`;
    const latestCtr = latest.exposure ? latest.clicks / latest.exposure * 100 : null;
    const latestCvr = latest.clicks ? latest.orders / latest.clicks * 100 : null;
    panel.innerHTML = `<div class="card" style="border-left:4px solid #38bdf8;">
      <div class="trend-panel-head">
        <div>
          <div class="card-title" style="margin-bottom:4px;">📈 商品近7天趋势 <span>商品 ID ${escapeHtml(productId)}</span></div>
          <div style="font-size:12px;color:#64748b;">${escapeHtml(productName)} · ${escapeHtml(storeName)} · 按已导入快照逐日绘制（${points[0].date} 至 ${latest.date}，共 ${points.length} 天）</div>
        </div>
        <span class="tag ${points.length >= 3 ? "tag-green" : "tag-yellow"}">${points.length >= 3 ? "趋势可信" : `仅 ${points.length} 天数据，每天导入后自动变长`}</span>
      </div>
      <div class="trend-grid">
        ${chartCard("💰 GMV", series.gmv, "#0ea5e9", latest.hasGmv ? formatMoney(latest.gmv) : "待导入")}
        ${chartCard("👁 曝光量", series.exposure, "#8b5cf6", latest.hasExposure ? formatCompact(latest.exposure) : "待导入")}
        ${chartCard("👆 CTR 点击率", series.ctr, "#f59e0b", latestCtr != null ? `${latestCtr.toFixed(2)}%` : "待导入")}
        ${chartCard("🛒 CVR 成交转化率", series.cvr, "#10b981", latestCvr != null ? `${latestCvr.toFixed(2)}%` : "待导入")}
      </div>
      <div style="margin-top:8px;font-size:12px;color:#64748b;">CTR = 点击量 ÷ 曝光量；CVR = 订单数 ÷ 点击量（与顶部口径一致）。跨天缺失的指标不参与连线。</div>
    </div>`;
    panel.style.display = "";
  }

  function renderTrendSearch(keyword) {
    const panel = document.getElementById("product-trend-panel");
    if (!panel) return;
    const query = String(keyword || "").trim();
    if (!query) {
      panel.style.display = "none";
      return;
    }
    const data = bridge.getData();
    if (!data || !Array.isArray(data.stores)) return;
    const matches = [];
    const seen = new Set();
    data.stores.forEach((store) => {
      (store.snapshots || []).forEach((snapshot) => {
        (snapshot.products || []).forEach((product) => {
          if (!product.id || seen.has(product.id)) return;
          if (product.id === query || (query.length >= 4 && product.id.includes(query))) {
            seen.add(product.id);
            matches.push({ id: product.id, name: product.name, store: store.name });
          }
        });
      });
    });
    if (!matches.length) {
      panel.style.display = "none";
      return;
    }
    if (matches.length === 1) {
      renderProductTrend(matches[0].id);
      return;
    }
    panel.innerHTML = `<div class="card" style="border-left:4px solid #38bdf8;">
      <div class="card-title">🔍 找到 ${matches.length} 个匹配商品 <span>点击查看近7天趋势</span></div>
      <div class="lb-list">${matches.slice(0, 8).map((item) => `<div class="lb-row" style="cursor:pointer;" data-trend-id="${escapeHtml(item.id)}">
        <span class="lb-name">${escapeHtml(item.name)}</span>
        <span class="lb-sub">${escapeHtml(item.store)} · ${escapeHtml(item.id)}</span>
      </div>`).join("")}</div>
    </div>`;
    panel.style.display = "";
    panel.querySelectorAll("[data-trend-id]").forEach((row) => {
      row.addEventListener("click", () => renderProductTrend(row.getAttribute("data-trend-id")));
    });
  }

  /* ================= 2. 达人 BD：时间轴 + TOP10 ================= */
  let bdRange = null;
  let bdSort = "gmv";

  function renderBdPage() {
    const dailyPanel = document.getElementById("bd-daily-panel");
    const top10Panel = document.getElementById("bd-top10-panel");
    if (!dailyPanel && !top10Panel) return;
    const status = document.getElementById("bd-upload-status");
    const rows = extraData.creators;
    if (status && !status.dataset.touched) {
      status.className = `tag ${rows.length ? "tag-green" : "tag-yellow"}`;
      status.textContent = rows.length ? `已导入 ${rows.length} 条达人记录` : "待导入";
    }
    if (!bdRange) bdRange = makeRangeState("bd", "creators");
    if (!rows.length) {
      const guide = emptyBlock(`<b>达人数据待导入。</b>到「数据接入」页上传达人合作表（Excel/CSV 均可）后，这里自动按日期展示每位达人的状态、GMV、交付视频数与播放量；列名差异会自动识别。<br>建议字段：日期、达人、店铺、状态、GMV、视频数、播放量——但不是必须，有什么传什么。`);
      if (dailyPanel) dailyPanel.innerHTML = guide;
      if (top10Panel) top10Panel.innerHTML = emptyBlock(`达人数据导入后自动生成 TOP10 榜单。`);
      return;
    }
    const bounds = bdRange.getBounds();
    const scoped = recordsInRange("creators", bounds);

    if (dailyPanel) {
      if (!scoped.length) {
        dailyPanel.innerHTML = emptyBlock(`所选范围（${bounds.start || "?"} 至 ${bounds.end || "?"}）内没有达人记录，换个时间范围或导入更多日期。`);
      } else {
        const byDate = new Map();
        scoped.forEach((record) => {
          if (!byDate.has(record.date)) byDate.set(record.date, []);
          byDate.get(record.date).push(record);
        });
        const dates = [...byDate.keys()].sort().reverse();
        dailyPanel.innerHTML = dates.map((date) => {
          const dayRows = byDate.get(date);
          const dayGmv = dayRows.reduce((sum, record) => sum + (record.gmv || 0), 0);
          const body = dayRows.map((record) => `<tr>
            <td><strong>${escapeHtml(record.creator || "—")}</strong></td>
            <td>${escapeHtml(record.store || "—")}</td>
            <td>${escapeHtml(record.status || "待导入")}</td>
            <td>${record.gmv != null ? formatMoney(record.gmv) : "待导入"}</td>
            <td>${record.videos != null ? formatNumber(record.videos, 0) : "待导入"}</td>
            <td>${record.views != null ? formatCompact(record.views) : "待导入"}</td>
            <td>${escapeHtml(record.note || "")}</td>
          </tr>`).join("");
          return `<div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;">📅 ${escapeHtml(date)} <span style="font-weight:400;color:#94a3b8;font-size:11px;">${dayRows.length} 位达人</span></div>
              <div style="font-size:12px;color:#64748b;">当日合作 GMV：<b style="color:#0f172a;">${dayGmv ? formatMoney(dayGmv) : "待导入"}</b></div>
            </div>
            <div class="desktop-table-wrap"><table class="desktop-table">
              <thead><tr><th>达人</th><th>店铺</th><th>状态</th><th>GMV</th><th>视频数</th><th>播放量</th><th>备注</th></tr></thead>
              <tbody>${body}</tbody>
            </table></div>
          </div>`;
        }).join("");
      }
    }

    if (top10Panel) {
      if (!scoped.length) {
        top10Panel.innerHTML = emptyBlock("所选范围内没有达人记录。");
      } else {
        const byCreator = new Map();
        scoped.forEach((record) => {
          const key = record.creator || "未命名达人";
          const agg = byCreator.get(key) || { creator: key, gmv: 0, videos: 0, views: 0, hasGmv: false, hasVideos: false, hasViews: false, days: new Set() };
          if (record.gmv != null) { agg.gmv += record.gmv; agg.hasGmv = true; }
          if (record.videos != null) { agg.videos += record.videos; agg.hasVideos = true; }
          if (record.views != null) { agg.views += record.views; agg.hasViews = true; }
          if (record.date) agg.days.add(record.date);
          byCreator.set(key, agg);
        });
        const sortKey = bdSort === "videos" ? "videos" : bdSort === "views" ? "views" : "gmv";
        const sorted = [...byCreator.values()].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0)).slice(0, 10);
        const maxValue = sorted.length ? sorted[0][sortKey] || 1 : 1;
        const valueText = (agg) => {
          if (sortKey === "gmv") return agg.hasGmv ? formatMoney(agg.gmv) : "待导入";
          if (sortKey === "videos") return agg.hasVideos ? `${formatNumber(agg.videos, 0)} 条` : "待导入";
          return agg.hasViews ? formatCompact(agg.views) : "待导入";
        };
        top10Panel.innerHTML = `<div class="lb-list">${sorted.map((agg, index) => `<div class="lb-row" style="flex-wrap:wrap;">
          <span class="lb-rank">${index + 1}</span>
          <span class="lb-name">${escapeHtml(agg.creator)}</span>
          <span class="lb-sub">${agg.days.size} 天有记录 · 视频 ${agg.hasVideos ? formatNumber(agg.videos, 0) : "—"} · GMV ${agg.hasGmv ? formatMoney(agg.gmv) : "—"}</span>
          <span class="lb-value">${valueText(agg)}</span>
          <div class="lb-bar-wrap" style="flex-basis:100%;"><div class="lb-bar" style="width:${Math.max(4, (agg[sortKey] || 0) / maxValue * 100).toFixed(1)}%;"></div></div>
        </div>`).join("")}</div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">范围：${bounds.start} 至 ${bounds.end} · 指标按所选范围求和；缺字段的达人显示"待导入"，不以 0 计。</div>`;
      }
    }
  }

  function bindBdSortChips() {
    const chips = document.querySelectorAll("[data-bd-sort]");
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((item) => item.classList.remove("active"));
        chip.classList.add("active");
        bdSort = chip.getAttribute("data-bd-sort");
        renderBdPage();
      });
    });
  }

  /* ================= 3. 广告投放：时间轴 + 智能分析调整事项 + 素材库 ================= */
  let adsRange = null;
  let assetSort = "roas";

  function aggregateAdsByPlan(rows) {
    const byPlan = new Map();
    rows.forEach((record) => {
      const key = record.plan || "未命名计划";
      const agg = byPlan.get(key) || { plan: key, group: record.group || "", productId: record.productId || "", spend: 0, impressions: 0, clicks: 0, gmv: 0, hasGmv: false, hasSpend: false, status: record.status || "", days: new Set() };
      if (record.spend != null) { agg.spend += record.spend; agg.hasSpend = true; }
      if (record.impressions != null) agg.impressions += record.impressions;
      if (record.clicks != null) agg.clicks += record.clicks;
      if (record.gmv != null) { agg.gmv += record.gmv; agg.hasGmv = true; }
      if (record.date) agg.days.add(record.date);
      byPlan.set(key, agg);
    });
    return [...byPlan.values()].map((agg) => ({
      ...agg,
      ctr: agg.impressions ? agg.clicks / agg.impressions * 100 : null,
      roas: agg.hasSpend && agg.spend > 0 && agg.hasGmv ? agg.gmv / agg.spend : null,
    }));
  }

  function adsActionItems(scopedRows) {
    const plans = aggregateAdsByPlan(scopedRows);
    const items = [];
    plans.forEach((agg) => {
      const head = `<b>${escapeHtml(agg.plan)}</b>${agg.group ? ` · ${escapeHtml(agg.group)}` : ""}${agg.productId ? ` · 商品 ${escapeHtml(agg.productId)}` : ""} · 统计 ${agg.days.size} 天`;
      const metrics = `消耗 ${agg.hasSpend ? formatMoney(agg.spend) : "待导入"}；曝光 ${formatCompact(agg.impressions)}；CTR ${agg.ctr != null ? agg.ctr.toFixed(2) + "%" : "待导入"}；GMV ${agg.hasGmv ? formatMoney(agg.gmv) : "待导入"}；ROAS ${agg.roas != null ? agg.roas.toFixed(2) : "待导入"}`;
      if (agg.hasSpend && !agg.hasGmv) {
        items.push({
          sev: "low",
          title: `⏳ ${agg.plan} · 有消耗但缺 GMV 归因`,
          body: `${head}<br>【数据】${metrics}。<br>【问题】无法计算 ROAS，调价决策没有依据。<br>【建议动作】在广告后台补开"成交/GMV"归因列后重新导出上传；补齐前不要对该计划做大幅预算调整。`,
          tags: ["待归因"],
        });
      } else if (agg.roas != null && agg.roas < 1) {
        items.push({
          sev: "high",
          title: `🛑 ${agg.plan} · ROAS ${agg.roas.toFixed(2)}，亏损投放`,
          body: `${head}<br>【数据】${metrics}。<br>【问题】每投入 1 元仅回收 ${agg.roas.toFixed(2)} 元 GMV，处于亏损状态。<br>【建议动作】1) 立即将日预算缩减 50% 或直接暂停；2) 检查落地商品链接与受众定向；3) 从"优质达人素材库"挑高 ROAS 素材替换后再开新计划。<br>【预估影响】按当前消耗水平，每天可止损约 ${formatMoney(agg.spend / Math.max(1, agg.days.size))}。`,
          tags: ["立即处理", "关停/缩量"],
        });
      } else if (agg.roas != null && agg.roas < 2) {
        const ctrNote = agg.ctr != null && agg.ctr < 1.5 ? "CTR 低于 1.5%，素材吸引力不足是主因，优先换素材。" : "CTR 尚可，重点优化承接页与出价。";
        items.push({
          sev: "medium",
          title: `⚠️ ${agg.plan} · ROAS ${agg.roas.toFixed(2)}，效率偏低`,
          body: `${head}<br>【数据】${metrics}。<br>【分析】${ctrNote}<br>【建议动作】预算先降 20-30% 观察；同步测试 1-2 条新素材；T+3 后按新数据再判定。`,
          tags: ["需优化", "观察"],
        });
      } else if (agg.roas != null && agg.roas >= 3) {
        items.push({
          sev: "good",
          title: `🚀 ${agg.plan} · ROAS ${agg.roas.toFixed(2)}，建议扩量`,
          body: `${head}<br>【数据】${metrics}。<br>【建议动作】日预算可上调 20-30%（避免一次性翻倍导致模型波动）；复制计划测试相似受众；把该计划素材沉淀到素材库。`,
          tags: ["标杆", "扩量"],
        });
      }
      if (agg.ctr != null && agg.ctr < 1.5 && agg.impressions > 5000 && !(agg.roas != null && agg.roas < 1)) {
        items.push({
          sev: "medium",
          title: `👆 ${agg.plan} · CTR 仅 ${agg.ctr.toFixed(2)}%`,
          body: `${head}<br>【数据】${metrics}。<br>【分析】曝光充足但点击率低，素材前 3 秒钩子或封面不吸引。<br>【建议动作】从素材库选高 CTR 素材替换；保留原计划作对照，T+3 比较。`,
          tags: ["换素材"],
        });
      }
    });
    const severityOrder = { high: 0, medium: 1, low: 2, good: 3 };
    return items.sort((a, b) => severityOrder[a.sev] - severityOrder[b.sev]).slice(0, 8);
  }

  function renderAdsPage() {
    const dailyPanel = document.getElementById("ads-daily-panel");
    const actionsPanel = document.getElementById("ads-actions-panel");
    if (!dailyPanel && !actionsPanel) return;
    const status = document.getElementById("ads-upload-status");
    const rows = extraData.ads;
    if (status && !status.dataset.touched) {
      status.className = `tag ${rows.length ? "tag-green" : "tag-yellow"}`;
      status.textContent = rows.length ? `已导入 ${rows.length} 条广告记录` : "待导入";
    }
    if (!adsRange) adsRange = makeRangeState("ads", "ads");
    if (!rows.length) {
      const guide = emptyBlock(`<b>广告数据待导入。</b>到「数据接入」页上传广告后台导出的数据表后，这里自动按日期展示各计划消耗、曝光、CTR、GMV、ROAS；列名差异自动识别。<br>建议字段：日期、计划、广告组、商品ID、消耗、曝光、点击、GMV——有什么传什么。`);
      if (dailyPanel) dailyPanel.innerHTML = guide;
      if (actionsPanel) actionsPanel.innerHTML = emptyBlock(`广告数据导入后，这里会按规则自动生成调整事项（关停亏损计划 / 换素材 / 扩量标杆 / 补归因）。`);
      return;
    }
    const bounds = adsRange.getBounds();
    const scoped = recordsInRange("ads", bounds);

    if (dailyPanel) {
      if (!scoped.length) {
        dailyPanel.innerHTML = emptyBlock(`所选范围（${bounds.start || "?"} 至 ${bounds.end || "?"}）内没有广告记录。`);
      } else {
        const byDate = new Map();
        scoped.forEach((record) => {
          if (!byDate.has(record.date)) byDate.set(record.date, []);
          byDate.get(record.date).push(record);
        });
        const dates = [...byDate.keys()].sort().reverse();
        dailyPanel.innerHTML = dates.map((date) => {
          const dayRows = byDate.get(date);
          const daySpend = dayRows.reduce((sum, record) => sum + (record.spend || 0), 0);
          const dayGmv = dayRows.reduce((sum, record) => sum + (record.gmv || 0), 0);
          const body = dayRows.map((record) => {
            const ctr = record.ctr != null ? record.ctr : (record.impressions ? record.clicks / record.impressions * 100 : null);
            const roas = record.roas != null ? record.roas : (record.spend && record.gmv != null ? record.gmv / record.spend : null);
            return `<tr>
              <td><strong>${escapeHtml(record.plan || "—")}</strong></td>
              <td>${escapeHtml(record.group || "—")}</td>
              <td>${escapeHtml(record.productId || "—")}</td>
              <td style="font-weight:600;">${record.spend != null ? formatMoney(record.spend) : "待导入"}</td>
              <td>${formatCompact(record.impressions)}</td>
              <td>${ctr != null ? ctr.toFixed(2) + "%" : "待导入"}</td>
              <td>${record.gmv != null ? formatMoney(record.gmv) : "待导入"}</td>
              <td>${roas != null ? roas.toFixed(2) : "待导入"}</td>
              <td>${escapeHtml(record.status || "—")}</td>
            </tr>`;
          }).join("");
          return `<div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;">📅 ${escapeHtml(date)} <span style="font-weight:400;color:#94a3b8;font-size:11px;">${dayRows.length} 个计划</span></div>
              <div style="font-size:12px;color:#64748b;">消耗 <b style="color:#0f172a;">${daySpend ? formatMoney(daySpend) : "待导入"}</b> · GMV <b style="color:#0f172a;">${dayGmv ? formatMoney(dayGmv) : "待导入"}</b> · ROAS <b style="color:#0f172a;">${daySpend && dayGmv ? (dayGmv / daySpend).toFixed(2) : "待导入"}</b></div>
            </div>
            <div class="desktop-table-wrap"><table class="desktop-table">
              <thead><tr><th>计划</th><th>广告组</th><th>商品ID</th><th>消耗</th><th>曝光</th><th>CTR</th><th>GMV</th><th>ROAS</th><th>状态</th></tr></thead>
              <tbody>${body}</tbody>
            </table></div>
          </div>`;
        }).join("");
      }
    }

    if (actionsPanel) {
      if (!scoped.length) {
        actionsPanel.innerHTML = emptyBlock("所选范围内没有广告记录，暂无调整事项。");
      } else {
        const items = adsActionItems(scopedRows(scoped));
        if (!items.length) {
          actionsPanel.innerHTML = emptyBlock("所选范围内所有计划表现正常，无需调整。👍");
        } else {
          const tagClass = { high: "tag-red", medium: "tag-yellow", low: "tag-blue", good: "tag-green" };
          actionsPanel.innerHTML = items.map((item) => `<div class="priority-item sev-${item.sev}">
            <div class="priority-item-title">${item.title}</div>
            <div class="priority-item-body">${item.body}</div>
            <div class="priority-item-tags">${(item.tags || []).map((tag, index) => `<span class="tag ${index === 0 ? tagClass[item.sev] : "tag-gray"}">${escapeHtml(tag)}</span>`).join("")}</div>
          </div>`).join("") + `<div style="font-size:12px;color:#64748b;">规则：ROAS&lt;1 关停缩量 / ROAS 1-2 降预算+换素材 / ROAS≥3 扩量 / CTR&lt;1.5% 且曝光充足换素材 / 有消耗无 GMV 标记待归因。范围：${bounds.start} 至 ${bounds.end}。</div>`;
        }
      }
    }
  }

  function scopedRows(rows) {
    return rows;
  }

  /* ================= 素材库 ================= */
  function assetVideoMatchName(asset) {
    const text = String(asset.videoUrl || "");
    const base = text.split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, "").toLowerCase();
    return base;
  }

  async function renderAssetLibrary() {
    const panel = document.getElementById("asset-library-panel");
    if (!panel) return;
    const status = document.getElementById("asset-upload-status");
    const rows = extraData.assets;
    if (status && !status.dataset.touched) {
      status.className = `tag ${rows.length ? "tag-green" : "tag-yellow"}`;
      status.textContent = rows.length ? `素材库 ${rows.length} 条` : "待导入";
    }
    if (!rows.length) {
      panel.innerHTML = emptyBlock(`<b>素材库为空。</b>到「数据接入」页 · 优质达人素材库入口上传素材数据表（达人 / 视频链接 / 商品ID / 播放量 / GMV / ROAS / 标签）后生成素材卡片墙；视频文件也在那里上传，只保存在本机浏览器，按文件名自动关联。`);
      return;
    }
    const sorted = [...rows].sort((a, b) => (b[assetSort] || 0) - (a[assetSort] || 0));
    const cards = await Promise.all(sorted.map(async (asset) => {
      const base = assetVideoMatchName(asset);
      let videoHtml = "";
      if (base) {
        const names = [asset.videoUrl, `${base}.mp4`, `${base}.mov`];
        for (const name of names) {
          const blob = name && (await getVideoBlob(String(name)));
          if (blob) {
            const url = URL.createObjectURL(blob);
            videoHtml = `<video controls preload="metadata" src="${url}"></video>`;
            break;
          }
        }
      }
      const linkHtml = !videoHtml && asset.videoUrl && /^https?:\/\//i.test(asset.videoUrl)
        ? `<div style="padding:10px 12px 0;"><a href="${escapeHtml(asset.videoUrl)}" target="_blank" rel="noopener" style="font-size:12px;color:#2563eb;word-break:break-all;">🔗 打开视频链接</a></div>`
        : "";
      return `<div class="asset-card">
        ${videoHtml}
        ${linkHtml}
        <div class="asset-card-body">
          <div class="asset-card-title">${escapeHtml(asset.creator || "未命名达人")}</div>
          <div class="asset-card-meta">
            ${asset.productId ? `商品 ${escapeHtml(asset.productId)} · ` : ""}播放 ${asset.views != null ? formatCompact(asset.views) : "待导入"}<br>
            GMV <b>${asset.gmv != null ? formatMoney(asset.gmv) : "待导入"}</b> · ROAS <b>${asset.roas != null ? asset.roas.toFixed(2) : "待导入"}</b>
            ${asset.note ? `<br>${escapeHtml(asset.note)}` : ""}
          </div>
          ${asset.tags ? `<div class="asset-card-tags">${String(asset.tags).split(/[,，、\s]+/).filter(Boolean).map((tag) => `<span class="tag tag-blue">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </div>
      </div>`;
    }));
    panel.innerHTML = `<div class="asset-grid">${cards.join("")}</div>`;
  }

  function bindAssetSortChips() {
    const chips = document.querySelectorAll("[data-asset-sort]");
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((item) => item.classList.remove("active"));
        chip.classList.add("active");
        assetSort = chip.getAttribute("data-asset-sort");
        renderAssetLibrary();
      });
    });
  }

  async function handleAssetVideoImport(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const status = document.getElementById("asset-upload-status");
    try {
      for (const file of files) {
        await saveVideoBlob(file);
      }
      if (status) {
        status.dataset.touched = "1";
        status.className = "tag tag-green";
        status.textContent = `已存 ${files.length} 个视频到本机`;
      }
      await renderAssetLibrary();
      window.alert(`✅ ${files.length} 个素材视频已保存到本机浏览器\n\n系统会按文件名与素材表的"视频链接/文件名"列自动关联。`);
    } catch (error) {
      window.alert(`❌ 视频保存失败\n\n${error.message || "浏览器存储不可用"}`);
    } finally {
      event.target.value = "";
    }
  }

  /* ================= 4. 自营短视频：三个排行榜 + 时间轴 ================= */
  let videosRange = null;

  function renderVideosPage() {
    const panel = document.getElementById("video-leaderboard-panel");
    if (!panel) return;
    const status = document.getElementById("videos-upload-status");
    const rows = extraData.videos;
    if (status && !status.dataset.touched) {
      status.className = `tag ${rows.length ? "tag-green" : "tag-yellow"}`;
      status.textContent = rows.length ? `已导入 ${rows.length} 条视频记录` : "待导入";
    }
    if (!videosRange) videosRange = makeRangeState("videos", "videos");
    if (!rows.length) {
      panel.innerHTML = emptyBlock(`<b>视频数据待导入。</b>到「数据接入」页上传 TikTok Studio / Seller Center 导出的视频明细后，自动生成三个排行榜；列名差异自动识别。<br>建议字段：日期、账号、视频ID/链接、商品ID、播放量、GMV——有什么传什么。`);
      return;
    }
    const bounds = videosRange.getBounds();
    const scoped = recordsInRange("videos", bounds);
    if (!scoped.length) {
      panel.innerHTML = emptyBlock(`所选范围（${bounds.start || "?"} 至 ${bounds.end || "?"}）内没有视频记录，换个时间范围或导入更多日期。`);
      return;
    }

    // 账号聚合
    const byAccount = new Map();
    scoped.forEach((record) => {
      const key = record.account || "未命名账号";
      const agg = byAccount.get(key) || { account: key, gmv: 0, views: 0, videos: new Set(), hasGmv: false, hasViews: false };
      if (record.gmv != null) { agg.gmv += record.gmv; agg.hasGmv = true; }
      if (record.views != null) { agg.views += record.views; agg.hasViews = true; }
      if (record.videoId) agg.videos.add(record.videoId);
      byAccount.set(key, agg);
    });

    // 单条视频聚合（同一视频跨天求和）
    const byVideo = new Map();
    scoped.forEach((record) => {
      const key = record.videoId || `${record.account}-未知视频`;
      const agg = byVideo.get(key) || { videoId: record.videoId || "—", account: record.account || "—", productId: record.productId || "", views: 0, gmv: 0, hasViews: false };
      if (record.views != null) { agg.views += record.views; agg.hasViews = true; }
      if (record.gmv != null) agg.gmv += record.gmv;
      byVideo.set(key, agg);
    });

    const leaderboard = (items, valueKey, hasKey, format) => {
      const sorted = items.sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0)).slice(0, 10);
      if (!sorted.length) return emptyBlock("暂无数据。");
      const max = sorted[0][valueKey] || 1;
      return `<div class="lb-list">${sorted.map((item, index) => {
        const isVideoRow = item.videoId && item.account;
        const main = isVideoRow ? item.videoId : (item.account || item.videoId);
        const sub = isVideoRow ? `${item.account}${item.productId ? ` · 商品 ${item.productId}` : ""}` : `${item.videos.size} 条视频`;
        return `<div class="lb-row" style="flex-wrap:wrap;" title="${escapeHtml(item.videoId || "")}">
          <span class="lb-rank">${index + 1}</span>
          <span class="lb-name">${escapeHtml(main)}</span>
          <span class="lb-sub">${escapeHtml(sub)}</span>
          <span class="lb-value">${item[hasKey] ? format(item[valueKey]) : "待导入"}</span>
          <div class="lb-bar-wrap" style="flex-basis:100%;"><div class="lb-bar" style="width:${Math.max(4, (item[valueKey] || 0) / max * 100).toFixed(1)}%;"></div></div>
        </div>`;
      }).join("")}</div>`;
    };

    panel.innerHTML = `<div class="real-ranking-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="real-ranking-card gmv">
        <div class="real-ranking-title">💰 GMV 账号排行榜</div>
        <div class="real-ranking-subtitle">范围内各自营账号 GMV 合计</div>
        ${leaderboard([...byAccount.values()], "gmv", "hasGmv", (value) => formatMoney(value))}
      </div>
      <div class="real-ranking-card">
        <div class="real-ranking-title">▶️ 播放量账号排行榜</div>
        <div class="real-ranking-subtitle">范围内各自营账号播放量合计</div>
        ${leaderboard([...byAccount.values()], "views", "hasViews", (value) => formatCompact(value))}
      </div>
      <div class="real-ranking-card up">
        <div class="real-ranking-title">🔥 单条视频播放量排行榜</div>
        <div class="real-ranking-subtitle">范围内单条视频播放量合计（同视频跨天求和）</div>
        ${leaderboard([...byVideo.values()], "views", "hasViews", (value) => formatCompact(value))}
      </div>
    </div>
    <div style="margin-top:8px;font-size:12px;color:#64748b;">范围：${bounds.start} 至 ${bounds.end} · 缺字段的条目显示"待导入"，不以 0 计。</div>`;
  }

  /* ================= 经营总览「今日优先处理」的达人/广告/短视频来源 ================= */
  function creatorPriorityProvider() {
    const rows = extraData.creators;
    if (!rows.length) {
      return { items: [], emptyHtml: `<b>达人合作表未导入。</b>到「数据接入」页上传达人合作表后，这里会自动列出优先处理项：状态异常、待跟进、寄样未回传等，并附数据与建议动作。` };
    }
    const latestDate = datasetDates("creators").pop();
    const latestRows = rows.filter((record) => record.date === latestDate);
    const items = [];
    latestRows.forEach((record) => {
      const statusText = String(record.status || "");
      const head = `<b>${escapeHtml(record.creator || "未命名达人")}</b>${record.store ? ` · ${escapeHtml(record.store)}` : ""} · ${escapeHtml(latestDate)}`;
      if (/异常|违规|终止|失联/.test(statusText)) {
        items.push({
          sev: "high",
          title: `🚨 ${record.creator || "达人"} · 合作状态异常`,
          body: `${head}<br>【现状】状态：${escapeHtml(statusText)}；GMV ${record.gmv != null ? formatMoney(record.gmv) : "待导入"}；视频 ${record.videos != null ? formatNumber(record.videos, 0) : "待导入"} 条。${record.note ? `<br>【备注】${escapeHtml(record.note)}` : ""}<br>【建议动作】当天联系确认情况；48 小时无响应按团队 SOP 降级或替换达人。`,
          tags: ["高优先级", "达人异常"],
        });
      } else if (/待跟进|未回|未回复|待回传|签收未/.test(statusText)) {
        items.push({
          sev: "medium",
          title: `📬 ${record.creator || "达人"} · ${statusText}`,
          body: `${head}<br>【现状】状态：${escapeHtml(statusText)}；GMV ${record.gmv != null ? formatMoney(record.gmv) : "待导入"}。${record.note ? `<br>【备注】${escapeHtml(record.note)}` : ""}<br>【建议动作】今日完成跟进并记录结果；按"D+3 提醒、D+5 确认、D+7 最后跟进"节奏执行。`,
          tags: ["待跟进", "今日"],
        });
      }
    });
    return {
      items: items.slice(0, 8),
      emptyHtml: `最新日期（${escapeHtml(latestDate || "—")}）没有异常或待跟进达人，合作运转正常。👍`,
    };
  }

  function adsPriorityProvider() {
    const rows = extraData.ads;
    if (!rows.length) {
      return { items: [], emptyHtml: `<b>广告数据未导入。</b>到「数据接入」页上传广告后台导出表后，这里会自动列出优先处理项：亏损计划关停、低效计划优化、标杆计划扩量、待归因提醒。` };
    }
    const dates = datasetDates("ads");
    const latest = dates[dates.length - 1];
    const scoped = rows.filter((record) => record.date === latest);
    const items = adsActionItems(scoped).slice(0, 5);
    return { items, emptyHtml: `最新日期（${escapeHtml(latest || "—")}）广告计划表现正常，无需优先处理。👍` };
  }

  function videoPriorityProvider() {
    const rows = extraData.videos;
    if (!rows.length) {
      return { items: [], emptyHtml: `<b>自营视频数据未导入。</b>到「数据接入」页上传视频明细后，这里会自动列出优先处理项：0 播放/低播放视频复盘、爆款视频复用建议。` };
    }
    const dates = datasetDates("videos");
    const latest = dates[dates.length - 1];
    const scoped = rows.filter((record) => record.date === latest);
    const items = [];
    const viewsValues = scoped.map((record) => record.views).filter((value) => value != null);
    const median = viewsValues.length ? viewsValues.sort((a, b) => a - b)[Math.floor(viewsValues.length / 2)] : null;
    scoped.forEach((record) => {
      const head = `<b>${escapeHtml(record.account || "未命名账号")}</b> · 视频 ${escapeHtml(record.videoId || "—")} · ${escapeHtml(latest)}`;
      if (record.views != null && record.views === 0) {
        items.push({
          sev: "high",
          title: `⛔ ${record.account || "账号"} · 视频 0 播放`,
          body: `${head}<br>【现状】发布 24 小时级播放为 0，疑似未过审或账号限流。${record.productId ? `关联商品 ${escapeHtml(record.productId)}。` : ""}<br>【建议动作】检查视频状态（审核/违规）；同账号连续出现则排查账号健康度。`,
          tags: ["高优先级", "0播放"],
        });
      } else if (median != null && record.views != null && record.views < median * 0.2 && record.views > 0) {
        items.push({
          sev: "medium",
          title: `📉 ${record.account || "账号"} · 播放远低于账号中位数`,
          body: `${head}<br>【现状】播放 ${formatCompact(record.views)}，仅为当日账号中位数（${formatCompact(median)}）的 20% 以下。<br>【建议动作】复盘选题与前 3 秒钩子；暂不加投，先优化内容模型。`,
          tags: ["中优先级", "内容复盘"],
        });
      } else if (median != null && record.views != null && record.views > median * 3) {
        items.push({
          sev: "good",
          title: `🔥 ${record.account || "账号"} · 播放超中位数 3 倍（爆款苗头）`,
          body: `${head}<br>【现状】播放 ${formatCompact(record.views)}${record.gmv != null ? `，GMV ${formatMoney(record.gmv)}` : ""}。<br>【建议动作】评估追投广告放大；拆解选题/脚本要素沉淀到知识库与素材库。`,
          tags: ["标杆", "可复用"],
        });
      }
    });
    const severityOrder = { high: 0, medium: 1, low: 2, good: 3 };
    items.sort((a, b) => severityOrder[a.sev] - severityOrder[b.sev]);
    return { items: items.slice(0, 8), emptyHtml: `最新日期（${escapeHtml(latest || "—")}）自营视频无异常。👍` };
  }

  window.OPS_EXT_PRIORITY_PROVIDERS = {
    creator: creatorPriorityProvider,
    ads: adsPriorityProvider,
    video: videoPriorityProvider,
  };

  /* ================= 初始化 ================= */
  function renderAllExtensions() {
    renderBdPage();
    renderAdsPage();
    renderAssetLibrary();
    renderVideosPage();
    const searchInput = document.getElementById("alert-search-input");
    if (searchInput && searchInput.value.trim()) renderTrendSearch(searchInput.value);
  }

  function bindInputs() {
    const bind = (id, handler) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener("change", handler);
    };
    bind("bd-file-input", (event) => handleDatasetImport(event, "creators", "bd-upload-status"));
    bind("ads-file-input", (event) => handleDatasetImport(event, "ads", "ads-upload-status"));
    bind("videos-file-input", (event) => handleDatasetImport(event, "videos", "videos-upload-status"));
    bind("asset-file-input", (event) => handleDatasetImport(event, "assets", "asset-upload-status"));
    bind("asset-video-input", handleAssetVideoImport);
    const searchInput = document.getElementById("alert-search-input");
    if (searchInput) searchInput.addEventListener("input", () => renderTrendSearch(searchInput.value));
    bindBdSortChips();
    bindAssetSortChips();
  }

  window.OPS_EXT = { render: renderAllExtensions, hasImportedData: (datasetKey) => datasetKey ? Boolean((extraData[datasetKey] || []).length) : Boolean(extraData.creators.length || extraData.ads.length || extraData.videos.length || extraData.assets.length), clearDataset: async (datasetKey) => { if (!Object.prototype.hasOwnProperty.call(extraData, datasetKey)) return; extraData[datasetKey] = []; await saveExtraData(); renderAllExtensions(); bridge.renderPriorityPanel(); } };

  loadExtraData().then(() => {
    bindInputs();
    renderAllExtensions();
    window.dispatchEvent(new CustomEvent("real-data-ready"));
    bridge.renderPriorityPanel();
  });
})();
