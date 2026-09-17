(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OPS_ACTION_VALIDATION_VIEW = factory();
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function renderValidationTable(items, escapeHtml) {
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (value) => String(value == null ? '' : value);
    const rows = Array.isArray(items) ? items : [];
    const body = rows.length ? rows.map((item) => {
      const action = item?.action || {};
      const checks = Array.isArray(item?.checks) ? item.checks : [];
      const verdict = item?.verdict || '待验证';
      const statusClass = verdict === '有效' ? 'tag-green' : verdict === '无效' ? 'tag-red' : 'tag-yellow';
      const nodes = checks.length ? checks.map((check) => `T+${check.node}`).join(' / ') : '待追踪';
      const detail = action.detail && action.detail !== action.actionType ? `<br><span style="font-size:11px;color:#64748b;">${esc(action.detail)}</span>` : '';
      return `<tr><td><strong>${esc(action.date || '待填写')}</strong></td><td>${esc(action.store || '未填写')}</td><td><strong>${esc(action.productId || '未填商品')}</strong></td><td>${esc(action.actionType || action.detail || '未填写')}${detail}</td><td>${esc(action.owner || '未填写')}</td><td><span class="tag ${statusClass}">${esc(verdict)}</span></td><td><span class="tag tag-dark">${esc(nodes)}</span></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="real-empty-cell">暂无真实动作记录。上传动作 CSV/XLSX 后，记录会自动显示在这里。</td></tr>';
    return `<div class="card" style="margin-bottom:14px;"><div class="card-title">📋 运营动作记录 <span>仅显示真实导入或手动录入数据</span></div><div class="desktop-table-wrap"><table class="desktop-table"><thead><tr><th>执行时间戳</th><th>店铺</th><th>对象</th><th>已执行动作</th><th>负责人</th><th>验证状态</th><th>验证节点</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
  }

  return { renderValidationTable };
}));
