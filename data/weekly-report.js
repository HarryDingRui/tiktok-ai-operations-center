(function () {
  'use strict';

  const CORE = window.WEEKLY_REPORT_CORE;
  const STORAGE_KEY = 'tiktok-weekly-report-v1';
  const TABLE_STYLE = 'width:100%;border-collapse:collapse;font-size:12px;';
  const CELL_STYLE = 'padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top;';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function money(value) {
    if (value == null || !Number.isFinite(Number(value))) return '待导入';
    return `฿${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  function integer(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function percent(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return `${(Number(value) * 100).toFixed(1)}%`;
  }

  function changeClass(value) {
    return Number(value) < 0 ? 'color:#dc2626;' : Number(value) > 0 ? 'color:#059669;' : 'color:#64748b;';
  }

  function metric(record, name) {
    return record?.metrics?.[name]?.current ?? null;
  }

  function renderTable(headers, rows) {
    if (!rows.length) return '<div class="ops-empty">暂无该类周报数据</div>';
    return `<div style="overflow:auto"><table style="${TABLE_STYLE}"><thead><tr>${headers.map((header) => `<th style="${CELL_STYLE}font-weight:600;color:#475569;white-space:nowrap;">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }

  function summaryHtml(report) {
    const stores = report.storeSummary || [];
    const comparison = report.periods?.comparison?.label || '上期';
    const primary = report.periods?.primary?.label || '本期';
    const rows = stores.map((record) => {
      const gmv = record.metrics?.GMV;
      const orders = record.metrics?.orders;
      const units = record.metrics?.units;
      return `<tr><td style="${CELL_STYLE}font-weight:600;">${escapeHtml(record.store)}</td><td style="${CELL_STYLE}">${money(gmv?.comparison)}</td><td style="${CELL_STYLE}">${money(gmv?.current)}</td><td style="${CELL_STYLE}${changeClass(gmv?.change)}">${percent(gmv?.change)}</td><td style="${CELL_STYLE}">${integer(orders?.current)}</td><td style="${CELL_STYLE}">${integer(units?.current)}</td></tr>`;
    });
    return `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">成品周报快照 · ${escapeHtml(comparison)} → ${escapeHtml(primary)} · 不改写日级原始数据</div>${renderTable(['店铺', `${comparison} GMV`, `${primary} GMV`, 'GMV变化', `${primary}订单`, `${primary}成交件数`], rows)}`;
  }

  function topRows(records, limit) {
    return (records || []).slice(0, limit).map((record) => {
      const values = record.raw || [];
      return `<tr><td style="${CELL_STYLE}">${escapeHtml(values[0])}</td><td style="${CELL_STYLE}white-space:nowrap;">${escapeHtml(record.store)}</td><td style="${CELL_STYLE}">${escapeHtml(values[2])}</td><td style="${CELL_STYLE}max-width:360px;">${escapeHtml(values[3])}</td><td style="${CELL_STYLE}">${money(values[5])}</td><td style="${CELL_STYLE}${changeClass(values[7])}">${percent(values[7])}</td><td style="${CELL_STYLE}">${escapeHtml(values[16] || '')}</td></tr>`;
    });
  }

  function alertRows(records, limit) {
    return (records || []).slice(0, limit).map((record) => {
      const values = record.raw || [];
      return `<tr><td style="${CELL_STYLE}">${escapeHtml(values[0])}</td><td style="${CELL_STYLE}">${escapeHtml(record.store)}</td><td style="${CELL_STYLE}">${escapeHtml(values[2])}</td><td style="${CELL_STYLE}max-width:330px;">${escapeHtml(values[3])}</td><td style="${CELL_STYLE}">${escapeHtml(values[4])}</td><td style="${CELL_STYLE}">${money(values[6])}</td><td style="${CELL_STYLE}${changeClass(values[10] == null ? null : -values[10])}">${percent(values[10])}</td><td style="${CELL_STYLE}max-width:420px;">${escapeHtml(values[16])}</td></tr>`;
    });
  }

  function profitHtml(report) {
    const stores = (report.storeProfit || []).map((record) => {
      const values = record.raw || [];
      return `<tr><td style="${CELL_STYLE}font-weight:600;">${escapeHtml(record.store)}</td><td style="${CELL_STYLE}">${money(values[1])}</td><td style="${CELL_STYLE}">${money(values[12])}</td><td style="${CELL_STYLE}">${money(values[13])}</td><td style="${CELL_STYLE}">${percent(values[14])}</td></tr>`;
    });
    const channels = (report.channelProfit || []).map((record) => {
      const values = record.raw || [];
      return `<tr><td style="${CELL_STYLE}">${escapeHtml(values[0])}</td><td style="${CELL_STYLE}">${money(values[1])}</td><td style="${CELL_STYLE}">${integer(values[2])}</td><td style="${CELL_STYLE}">${percent(values[3])}</td><td style="${CELL_STYLE}">${money(values[9])}</td></tr>`;
    });
    const skus = (report.profitTop || []).slice(0, 5).map((record) => {
      const values = record.raw || [];
      return `<tr><td style="${CELL_STYLE}">${escapeHtml(values[0])}</td><td style="${CELL_STYLE}">${escapeHtml(values[1])}</td><td style="${CELL_STYLE}">${escapeHtml(record.storeLabel)}</td><td style="${CELL_STYLE}">${money(values[9])}</td><td style="${CELL_STYLE}">${percent(values[10])}</td></tr>`;
    });
    return `<div style="font-size:12px;color:#64748b;margin-bottom:10px;">店铺利润与渠道利润来自周报原表；费率仅作为本次快照字段展示，不写入全局费率设置。</div><div class="two-col"><div>${renderTable(['店铺', '商家成交额', '毛利总额', '预估净利', '净利润率'], stores)}</div><div>${renderTable(['渠道', '商家成交额', '销量', '销售额占比', '毛利总额'], channels)}</div></div><div style="margin-top:14px;">${renderTable(['排名', 'Seller SKU', '在售店铺', '毛利总额', '毛利率'], skus)}</div>`;
  }

  function samplesHtml(report) {
    const grouped = {};
    (report.samples || []).forEach((sample) => { const key = `${sample.store} · ${sample.type}`; grouped[key] = (grouped[key] || 0) + 1; });
    const rows = Object.keys(grouped).sort().map((key) => `<tr><td style="${CELL_STYLE}">${escapeHtml(key)}</td><td style="${CELL_STYLE}">${integer(grouped[key])}</td></tr>`);
    return `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">两类样品订单共 ${integer(report.samples?.length || 0)} 条明细；合计行不重复计入。</div>${renderTable(['店铺 · 类型', '明细数'], rows)}`;
  }

  function validationHtml(report) {
    const blocks = (report.priceValidation || []).map((item) => {
      const rows = item.metrics.map((metricRow) => `<tr><td style="${CELL_STYLE}">${escapeHtml(metricRow.label)}</td><td style="${CELL_STYLE}">${metricRow.before == null ? '—' : escapeHtml(metricRow.before)}</td><td style="${CELL_STYLE}">${metricRow.after == null ? '—' : escapeHtml(metricRow.after)}</td><td style="${CELL_STYLE}${changeClass(metricRow.change)}">${percent(metricRow.change)}</td></tr>`).join('');
      return `<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;"><div style="font-weight:600;color:#0f172a;">${escapeHtml(item.productId)} · ${escapeHtml(item.title.replace(/^商品ID[^|]*\|\s*/, ''))}</div><table style="${TABLE_STYLE};margin-top:8px;"><thead><tr><th style="${CELL_STYLE}">指标</th><th style="${CELL_STYLE}">调价前</th><th style="${CELL_STYLE}">调价后</th><th style="${CELL_STYLE}">变化</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:8px;color:#475569;line-height:1.6;">${escapeHtml(item.conclusion || '原表未提供文字结论')}</div></div>`;
    });
    return blocks.length ? blocks.join('') : '<div class="ops-empty">暂无调价验证快照</div>';
  }

  function reportOrNull() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return null; }
  }

  function ensureValidationPanel() {
    let panel = document.getElementById('weekly-report-validation-panel');
    if (panel) return panel;
    const root = document.querySelector('#page-validation [data-control-plane-root]');
    if (!root) return null;
    panel = document.createElement('div');
    panel.id = 'weekly-report-validation-panel';
    panel.className = 'card';
    panel.style.borderLeft = '4px solid #0ea5e9';
    panel.innerHTML = '<div class="card-title">📘 调价验证周报快照 <span>只展示表内结论，不自动替换真实动作验证</span> <button class="btn" type="button" onclick="showPage(\'data\', null)">去数据接入上传周报</button></div><div id="weekly-report-validation-content"><div class="ops-empty">暂无已导入的周报成品数据</div></div>';
    root.insertBefore(panel, root.firstChild);
    return panel;
  }

  function setStatus(message, className) {
    const element = document.getElementById('weekly-report-upload-status');
    if (element) { element.textContent = message; element.className = `tag ${className || 'tag-yellow'}`; }
  }

  function render() {
    const report = reportOrNull();
    const validationPanel = ensureValidationPanel();
    const overview = document.getElementById('weekly-report-overview');
    const overviewMeta = document.getElementById('weekly-report-overview-meta');
    const alertPanel = document.getElementById('weekly-report-alert-panel');
    const profitPanel = document.getElementById('weekly-report-profit-panel');
    const stylePanel = document.getElementById('weekly-report-style-panel');
    const samplePanel = document.getElementById('weekly-report-sample-panel');
    const validationContent = document.getElementById('weekly-report-validation-content') || validationPanel;
    const preview = document.getElementById('weekly-report-preview');
    if (!report) {
      [overview, alertPanel, profitPanel, stylePanel, samplePanel, validationContent].forEach((element) => { if (element) element.innerHTML = '<div class="ops-empty">暂无已导入的周报成品数据</div>'; });
      if (overviewMeta) overviewMeta.textContent = '待导入';
      if (preview) preview.innerHTML = '<div class="ops-empty">选择 xlsx 文件后先预览映射和行数，确认后才会写入本机浏览器。</div>';
      setStatus('待导入', 'tag-yellow');
      return;
    }
    const periodLabel = `${report.periods?.comparison?.label || '上期'} → ${report.periods?.primary?.label || '本期'}`;
    if (overviewMeta) overviewMeta.textContent = `${periodLabel} · ${report.sourceFile}`;
    if (overview) overview.innerHTML = summaryHtml(report);
    if (alertPanel) alertPanel.innerHTML = `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">下滑/上涨榜各 ${report.growthTop.length}/${report.declineTop.length} 条；商品预警 ${report.alerts.length} 条。</div><div class="two-col"><div>${renderTable(['排名', '店铺', '商品ID', '商品名称', '本期GMV', '变化', '主因'], topRows(report.growthTop, 5))}</div><div>${renderTable(['排名', '店铺', '商品ID', '商品名称', '本期GMV', '变化', '主因'], topRows(report.declineTop, 5))}</div></div><div style="margin-top:14px;">${renderTable(['排名', '店铺', '商品ID', '商品名称', '预警类型', '本期GMV', '曝光降幅', '解决方案'], alertRows(report.alerts, 20))}</div>`;
    if (profitPanel) profitPanel.innerHTML = profitHtml(report);
    if (stylePanel) stylePanel.innerHTML = renderTable(['货号', 'Seller SKU', '在售店铺', 'SKU销量', 'SKU成交额', '货号GMV'], (report.styleAnalysis || []).slice(0, 20).map((record) => { const v = record.raw || []; return `<tr><td style="${CELL_STYLE}">${escapeHtml(record.cargoNumber)}</td><td style="${CELL_STYLE}">${escapeHtml(v[1])}</td><td style="${CELL_STYLE}">${escapeHtml(record.storeLabel)}</td><td style="${CELL_STYLE}">${integer(v[3])}</td><td style="${CELL_STYLE}">${money(v[4])}</td><td style="${CELL_STYLE}">${money(v[8])}</td></tr>`; }));
    if (samplePanel) samplePanel.innerHTML = samplesHtml(report);
    if (validationContent) validationContent.innerHTML = validationHtml(report);
    if (preview) preview.innerHTML = `<div class="alert alert-info"><span>✅</span><span>已导入：${escapeHtml(report.sourceFile)} · ${escapeHtml(periodLabel)} · 10 张表 · 店铺 ${report.storeSummary.length} 条 · 商品预警 ${report.alerts.length} 条 · 样品明细 ${report.samples.length} 条</span></div>`;
    setStatus(`已导入 · ${periodLabel}`, 'tag-green');
  }

  async function parseFile(file) {
    if (!CORE || !window.XLSX) throw new Error('周报解析组件未加载');
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, raw: true });
    const sheets = {};
    workbook.SheetNames.forEach((sheetName) => { sheets[sheetName] = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true }); });
    const report = CORE.parseWeeklyReportWorkbook(sheets, file.name);
    const validation = CORE.validateWeeklyReport(report);
    if (!validation.valid) throw new Error(validation.errors.join('；'));
    return report;
  }

  function renderPreview(report) {
    const preview = document.getElementById('weekly-report-preview');
    if (!preview) return;
    preview.innerHTML = `<div class="alert alert-info"><span>🔎</span><span>解析成功：${escapeHtml(report.sourceFile)} · ${escapeHtml(report.periods?.comparison?.label || '上期')} → ${escapeHtml(report.periods?.primary?.label || '本期')} · 识别 ${Object.keys(report).filter((key) => Array.isArray(report[key])).length} 类数据 · 店铺映射：${escapeHtml(report.storeSummary.map((row) => row.store).join('、'))}${report.unmappedStores.length ? ` · <strong style="color:#dc2626;">未映射：${escapeHtml(report.unmappedStores.join('、'))}</strong>` : ''}。点击“确认写入”后才会保存。</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"><button id="weekly-report-confirm" class="btn btn-primary" type="button">确认写入本机</button><button id="weekly-report-cancel" class="btn" type="button">取消</button></div>`;
    document.getElementById('weekly-report-confirm')?.addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
      setStatus(`已导入 · ${report.periods?.primary?.label || '本期'}`, 'tag-green');
      render();
      window.dispatchEvent(new CustomEvent('weekly-report-ready', { detail: report }));
    });
    document.getElementById('weekly-report-cancel')?.addEventListener('click', render);
  }

  function bind() {
    const input = document.getElementById('weekly-report-file-input');
    const zone = document.getElementById('weekly-report-upload-zone');
    const clear = document.getElementById('weekly-report-clear');
    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      setStatus('解析中…', 'tag-blue');
      try { renderPreview(await parseFile(file)); setStatus('已解析待确认', 'tag-blue'); }
      catch (error) { setStatus('解析失败', 'tag-red'); const preview = document.getElementById('weekly-report-preview'); if (preview) preview.innerHTML = `<div class="alert alert-danger"><span>⚠️</span><span>${escapeHtml(error.message || error)}</span></div>`; }
      input.value = '';
    });
    zone?.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('dragover'); });
    zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone?.addEventListener('drop', (event) => { event.preventDefault(); zone.classList.remove('dragover'); const file = event.dataTransfer?.files?.[0]; if (file && input) { const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change')); } });
    clear?.addEventListener('click', () => { if (!reportOrNull() || !window.confirm('确认删除本机保存的周报成品数据？删除后需要重新导入。')) return; localStorage.removeItem(STORAGE_KEY); render(); window.dispatchEvent(new CustomEvent('weekly-report-deleted')); });
    render();
  }

  window.OPS_WEEKLY_REPORT = { getReport: reportOrNull, hasData: () => Boolean(reportOrNull()), parseFile, render, clear: () => { localStorage.removeItem(STORAGE_KEY); render(); } };
  window.addEventListener('control-plane-rendered', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();
