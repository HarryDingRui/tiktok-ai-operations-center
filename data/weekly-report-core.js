(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WEEKLY_REPORT_CORE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORE_ALIASES = {
    'yaya113': 'PETTOS',
    'pettos': 'PETTOS',
    'yaya thailand': 'yaya thailand tth',
    'yaya thailand tth': 'yaya thailand tth',
    'inspire': 'INSPIRE PURIFY',
    'inspire mall': 'INSPIRE PURIFY',
    'inspire purify': 'INSPIRE PURIFY',
    'yaya112': 'yaya112',
    'miniyaya': 'Miniyaya',
  };

  const STORE_NAMES = new Set(Object.values(STORE_ALIASES));
  const IGNORED_STORE_LABELS = new Set(['合计', '总计', '全部店铺', '店铺']);

  function text(value) {
    return value == null ? '' : String(value).replace(/\u00a0/g, ' ').trim();
  }

  function isBlankRow(row) {
    return !Array.isArray(row) || row.every((value) => text(value) === '');
  }

  function number(value) {
    if (value == null || value === '' || value === '—' || value === '-') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(String(value).replace(/[,฿%]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function canonicalStoreName(value) {
    const raw = text(value);
    if (!raw) return '';
    const key = raw.toLowerCase().replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
    return STORE_ALIASES[key] || raw;
  }

  function splitStores(value) {
    return text(value)
      .split(/[、,，;；\n\r|]+/)
      .map((part) => canonicalStoreName(part))
      .filter(Boolean);
  }

  function collectUnmappedStores(value, unmapped) {
    splitStores(value).forEach((store) => {
      if (!STORE_NAMES.has(store) && !IGNORED_STORE_LABELS.has(store)) unmapped.add(store);
    });
  }

  function classifySheet(name) {
    const value = text(name);
    if (value.startsWith('②')) return 'storeSummary';
    if (value.startsWith('③')) return 'top30';
    if (value.startsWith('④')) return 'rankings';
    if (value.startsWith('⑤')) return 'alerts';
    if (value.startsWith('⑥')) return 'storeProfit';
    if (value.startsWith('⑦')) return 'skuProfit';
    if (value.startsWith('⑧')) return 'channelProfit';
    if (value.startsWith('⑨')) return 'styleAnalysis';
    if (value.startsWith('⑩')) return 'samples';
    if (value.includes('调价验证')) return 'priceValidation';
    return 'unknown';
  }

  function findHeader(rows, predicate, startAt) {
    for (let index = startAt || 0; index < rows.length; index += 1) {
      if (predicate(rows[index] || [])) return index;
    }
    return -1;
  }

  function headerMap(row) {
    const map = {};
    (row || []).forEach((value, index) => {
      const label = text(value).replace(/[\r\n]+/g, ' ');
      if (label) map[label] = index;
    });
    return map;
  }

  function indexOfHeader(map, candidates) {
    const labels = Object.keys(map);
    for (const candidate of candidates) {
      const exact = labels.find((label) => label === candidate);
      if (exact) return map[exact];
      const partial = labels.find((label) => label.includes(candidate));
      if (partial) return map[partial];
    }
    return -1;
  }

  function storeFields(rawValue, unmappedStores) {
    collectUnmappedStores(rawValue, unmappedStores);
    const stores = splitStores(rawValue);
    return {
      store: stores.length === 1 ? stores[0] : text(rawValue),
      stores,
      storeLabel: text(rawValue),
    };
  }

  function parsePeriod(value) {
    const label = text(value);
    const match = label.match(/(\d{1,2})[./-](\d{1,2})\s*[-至到]\s*(\d{1,2})[./-](\d{1,2})/);
    if (!match) return { label };
    const year = new Date().getFullYear();
    return {
      label,
      start: `${year}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`,
      end: `${year}-${String(match[3]).padStart(2, '0')}-${String(match[4]).padStart(2, '0')}`,
    };
  }

  function metricKey(label) {
    const value = text(label).replace(/[（(].*?[）)]/g, '').replace(/\s+/g, '');
    if (value.includes('GMV')) return value.includes('占比') ? 'GMVShare' : 'GMV';
    if (value.includes('订单')) return 'orders';
    if (value.includes('成交件')) return 'units';
    if (value.includes('曝光')) return 'exposure';
    if (value.includes('点击')) return 'clicks';
    if (value.startsWith('CTR')) return 'CTR';
    if (value.startsWith('CVR')) return 'CVR';
    if (value.startsWith('GPM')) return 'GPM';
    if (value.includes('新视频')) return 'newVideos';
    if (value.includes('退款')) return 'refunds';
    return value || 'metric';
  }

  function parseSummarySections(rows) {
    const storeSummary = [];
    const unmappedStores = new Set();
    const periods = {};
    for (let index = 0; index < rows.length; index += 1) {
      const title = text((rows[index] || [])[0]);
      const titleMatch = title.match(/^【(总|分)】\s*(.*?)\s*·/);
      if (!titleMatch) continue;
      const store = titleMatch[1] === '总' ? '全部店铺' : canonicalStoreName(titleMatch[2]);
      if (store !== '全部店铺') collectUnmappedStores(store, unmappedStores);
      const headerIndex = findHeader(rows, (row) => text(row[0]) === '指标', index + 1);
      if (headerIndex < 0) continue;
      const header = rows[headerIndex] || [];
      if (!periods.comparison) periods.comparison = parsePeriod(header[1]);
      if (!periods.primary) periods.primary = parsePeriod(header[2]);
      const metrics = {};
      for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] || [];
        const rowTitle = text(row[0]);
        if (!rowTitle || /^【/.test(rowTitle)) break;
        const key = metricKey(rowTitle);
        metrics[key] = {
          label: rowTitle,
          comparison: number(row[1]),
          current: number(row[2]),
          change: number(row[3]),
        };
      }
      storeSummary.push({ store, scope: titleMatch[1] === '总' ? 'total' : 'store', sourceLabel: title, metrics });
    }
    return { storeSummary, periods, unmappedStores: Array.from(unmappedStores).sort() };
  }

  function rowObject(row, map) {
    const result = { raw: row.slice() };
    Object.keys(map).forEach((label) => {
      result[label] = row[map[label]] == null ? null : row[map[label]];
    });
    return result;
  }

  function parseTop30Rows(rows) {
    const growthHeader = findHeader(rows, (row) => text(row[0]) === '排名' && text(row[1]) === '店铺');
    const declineHeader = findHeader(rows, (row) => text(row[0]) === '排名' && text(row[1]) === '店铺', growthHeader + 1);
    const unmappedStores = new Set();
    const parseBlock = (headerIndex, endIndex, direction) => {
      if (headerIndex < 0) return [];
      const map = headerMap(rows[headerIndex]);
      const records = [];
      for (let index = headerIndex + 1; index < (endIndex < 0 ? rows.length : endIndex); index += 1) {
        const row = rows[index] || [];
        if (isBlankRow(row) || !Number.isFinite(number(row[map['排名'] ?? 0]))) continue;
        const record = rowObject(row, map);
        Object.assign(record, storeFields(row[map['店铺']], unmappedStores), { direction });
        records.push(record);
      }
      return records;
    };
    return {
      growthTop: parseBlock(growthHeader, declineHeader, 'growth'),
      declineTop: parseBlock(declineHeader, -1, 'decline'),
      unmappedStores: Array.from(unmappedStores).sort(),
    };
  }

  function parseGenericTable(rows, predicate, options) {
    const settings = options || {};
    const headerIndex = findHeader(rows, predicate);
    if (headerIndex < 0) return { rows: [], totals: [], unmappedStores: [] };
    const map = headerMap(rows[headerIndex]);
    const result = [];
    const totals = [];
    const unmappedStores = new Set();
    let previousCargo = '';
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] || [];
      if (isBlankRow(row)) {
        if (settings.stopAtBlank) break;
        continue;
      }
      const firstCell = text(row[0]);
      if (settings.stopAtTitle && (/^【/.test(firstCell) || /^商品ID/.test(firstCell))) break;
      if (settings.total && settings.total(row, map)) {
        totals.push(rowObject(row, map));
        continue;
      }
      if (settings.skip && settings.skip(row, map)) continue;
      if (settings.requireFirst && !text(row[map[settings.requireFirst] ?? 0])) continue;
      const record = rowObject(row, map);
      if (settings.storeColumn) {
        Object.assign(record, storeFields(row[map[settings.storeColumn]], unmappedStores));
      }
      if (settings.cargoColumn) {
        const cargo = text(row[map[settings.cargoColumn]]) || previousCargo;
        previousCargo = cargo;
        record.cargoNumber = cargo;
      }
      result.push(record);
    }
    return { rows: result, totals, unmappedStores: Array.from(unmappedStores).sort() };
  }

  function parseRankings(rows) {
    const gmv = parseGenericTable(rows, (row) => text(row[0]) === '排名' && text(row[1]) === '商品ID' && text(row[3]).includes('GMV'), {
      storeColumn: '在售店铺', requireFirst: '商品ID', stopAtTitle: true, stopAtBlank: true,
    });
    const profit = parseGenericTable(rows, (row) => text(row[0]) === '排名' && text(row[1]) === 'Seller SKU', {
      storeColumn: '在售店铺', requireFirst: 'Seller SKU', stopAtTitle: true, stopAtBlank: true,
    });
    return {
      gmvTop: gmv.rows,
      profitTop: profit.rows,
      unmappedStores: [...new Set([...gmv.unmappedStores, ...profit.unmappedStores])].sort(),
    };
  }

  function parseSamples(rows) {
    const samples = [];
    const unmappedStores = new Set();
    let type = '';
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const first = text(row[0]);
      const typeMatch = first.match(/^【(类型[^】]+)】/);
      if (typeMatch) {
        type = typeMatch[1];
        continue;
      }
      if (first === '店铺') {
        for (let itemIndex = index + 1; itemIndex < rows.length; itemIndex += 1) {
          const item = rows[itemIndex] || [];
          const store = text(item[0]);
          if (!store || store === '合计' || isBlankRow(item)) break;
          collectUnmappedStores(store, unmappedStores);
          samples.push({ type, store: canonicalStoreName(store), storeLabel: store, orderId: item[1], sellerSku: item[2], quantity: number(item[3]), orderedAt: item[4], channel: item[5], buyer: item[6], amount: number(item[7]), raw: item.slice() });
        }
      }
    }
    return { samples, unmappedStores: Array.from(unmappedStores).sort() };
  }

  function parsePriceValidation(rows) {
    const priceValidation = [];
    for (let index = 0; index < rows.length; index += 1) {
      const title = text((rows[index] || [])[0]);
      if (!/^商品ID/.test(title)) continue;
      const headerIndex = findHeader(rows, (row) => text(row[0]) === '指标', index + 1);
      if (headerIndex < 0) continue;
      const header = rows[headerIndex] || [];
      const metrics = [];
      let conclusion = '';
      for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] || [];
        const label = text(row[0]);
        if (!label || /^商品ID/.test(label)) break;
        if (label.startsWith('▶')) { conclusion = label; break; }
        metrics.push({ label, before: number(row[1]), after: number(row[2]), change: number(row[3]) });
      }
      const productId = (title.match(/商品ID\s*([^|\s]+)/) || [])[1] || '';
      priceValidation.push({ productId, title, metrics, conclusion });
    }
    return { priceValidation, unmappedStores: [] };
  }

  function mergeUnmapped(target, values) {
    (values || []).forEach((value) => target.add(value));
  }

  function parseWeeklyReportWorkbook(sheetRowsByName, sourceFile) {
    const report = {
      version: 1,
      sourceFile: text(sourceFile),
      importedAt: new Date().toISOString(),
      periods: {},
      storeSummary: [], growthTop: [], declineTop: [], gmvTop: [], profitTop: [], alerts: [],
      storeProfit: [], skuProfit: [], channelProfit: [], styleAnalysis: [], samples: [], priceValidation: [],
      totals: {}, unmappedStores: [],
    };
    const unmappedStores = new Set();
    Object.keys(sheetRowsByName || {}).forEach((sheetName) => {
      const rows = sheetRowsByName[sheetName] || [];
      const type = classifySheet(sheetName);
      if (type === 'storeSummary') {
        const parsed = parseSummarySections(rows);
        report.storeSummary = parsed.storeSummary;
        report.periods = parsed.periods;
        mergeUnmapped(unmappedStores, parsed.unmappedStores);
      } else if (type === 'top30') {
        const parsed = parseTop30Rows(rows);
        report.growthTop = parsed.growthTop;
        report.declineTop = parsed.declineTop;
        mergeUnmapped(unmappedStores, parsed.unmappedStores);
      } else if (type === 'rankings') {
        const parsed = parseRankings(rows);
        report.gmvTop = parsed.gmvTop;
        report.profitTop = parsed.profitTop;
        mergeUnmapped(unmappedStores, parsed.unmappedStores);
      } else if (type === 'alerts') {
        const parsed = parseGenericTable(rows, (row) => text(row[0]) === '排名' && text(row[1]) === '店铺', { storeColumn: '店铺', requireFirst: '店铺', stopAtBlank: true });
        report.alerts = parsed.rows;
        mergeUnmapped(unmappedStores, parsed.unmappedStores);
      } else if (type === 'storeProfit') {
        const parsed = parseGenericTable(rows, (row) => text(row[0]) === '店铺' && text(row[1]).includes('商家成交额'), { storeColumn: '店铺', requireFirst: '店铺', total: (row) => ['合计', '总计'].includes(text(row[0])), stopAtBlank: true });
        report.storeProfit = parsed.rows;
        report.totals.storeProfit = parsed.totals[0] || null;
        mergeUnmapped(unmappedStores, parsed.unmappedStores);
      } else if (type === 'skuProfit') {
        const parsed = parseGenericTable(rows, (row) => text(row[0]) === 'Seller SKU', { storeColumn: '在售店铺', requireFirst: 'Seller SKU', total: (row) => ['合计', '总计'].includes(text(row[0])), stopAtBlank: true });
        report.skuProfit = parsed.rows;
        report.totals.skuProfit = parsed.totals[0] || null;
        mergeUnmapped(unmappedStores, parsed.unmappedStores);
      } else if (type === 'channelProfit') {
        const parsed = parseGenericTable(rows, (row) => text(row[0]) === '订单渠道', { requireFirst: '订单渠道', total: (row) => ['合计', '总计'].includes(text(row[0])), stopAtBlank: true });
        report.channelProfit = parsed.rows;
        report.totals.channelProfit = parsed.totals[0] || null;
      } else if (type === 'styleAnalysis') {
        const parsed = parseGenericTable(rows, (row) => text(row[0]) === '货号' && text(row[1]) === 'Seller SKU', { storeColumn: '在售店铺', cargoColumn: '货号', requireFirst: 'Seller SKU', stopAtBlank: true });
        report.styleAnalysis = parsed.rows;
        mergeUnmapped(unmappedStores, parsed.unmappedStores);
      } else if (type === 'samples') {
        const parsed = parseSamples(rows);
        report.samples = parsed.samples;
        mergeUnmapped(unmappedStores, parsed.unmappedStores);
      } else if (type === 'priceValidation') {
        report.priceValidation = parsePriceValidation(rows).priceValidation;
      }
    });
    report.unmappedStores = Array.from(unmappedStores).sort();
    return report;
  }

  function validateWeeklyReport(report) {
    const errors = [];
    if (!report || report.version !== 1) errors.push('报告版本无效');
    if (!report.sourceFile) errors.push('缺少来源文件名');
    if (!Array.isArray(report.storeSummary) || report.storeSummary.length === 0) errors.push('未解析到店铺周报');
    if ((report.unmappedStores || []).length) errors.push(`存在未映射店铺：${report.unmappedStores.join('、')}`);
    return { valid: errors.length === 0, errors };
  }

  return {
    canonicalStoreName,
    classifySheet,
    parsePeriod,
    parseSummarySections,
    parseTop30Rows,
    parseWeeklyReportWorkbook,
    validateWeeklyReport,
    splitStores,
  };
});
