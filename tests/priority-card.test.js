const assert = require("assert");
const { renderPriorityCard, sortPriorityItems, selectPriorityItems } = require("../data/priority-card.js");

const card = renderPriorityCard({
  sev: "high",
  title: "曝光大幅下降 3.4K",
  tags: ["高优先级", "区间首日 → 末日"],
  decision: {
    storeName: "yaya112",
    productName: "CATWELL 猫砂",
    productId: "1732702039573890790",
    interval: "2026-09-01 → 2026-09-14",
    metrics: [
      { label: "曝光", from: "3.4K", to: "17", delta: "减少 3.4K", direction: "down" },
      { label: "点击", from: "124", to: "0", delta: "减少 124", direction: "down" },
      { label: "成交", from: "15 件", to: "0 件", delta: "减少 15 件", direction: "down" },
      { label: "GMV", from: "฿2,371", to: "฿0", delta: "减少 ฿2,371", direction: "down" },
      { label: "转化率", from: "待导入", to: "待导入", delta: "暂无可比数据", direction: "unavailable" },
    ],
    diagnosis: "曝光与点击同步下滑，需优先检查流量入口。",
    primaryAction: "先检查推荐池、搜索排名和商品状态",
    actions: ["检查商品是否仍在推荐池", "核对违规、下架及类目调整记录"],
    impact: "末日较首日少 ฿2,371",
  },
});

assert(card.includes('class="priority-item sev-high priority-decision-card"'));
assert(card.includes("曝光大幅下降 3.4K"));
assert(card.includes("1732702039573890790"));
assert(card.includes('data-copy-product-id="1732702039573890790"'));
assert(card.includes('class="priority-metric priority-metric-down"'));
assert(card.includes('class="priority-metric priority-metric-unavailable"'));
assert(card.includes("↓"));
assert(card.includes("—"));
assert(card.includes("今天先做"));
assert(card.includes("先检查推荐池、搜索排名和商品状态"));
assert(card.includes("预计影响"));
assert(card.includes("末日较首日少 ฿2,371"));
assert(card.includes("<details"));
assert(card.includes("查看诊断详情"));
assert(!card.includes("主管决策卡"));

const escaped = renderPriorityCard({
  sev: "medium",
  title: "<script>alert(1)</script>",
  decision: {
    storeName: "店铺<一>",
    productName: "商品&名称",
    productId: '123" onclick="alert(1)',
    interval: "2026-09-01 → 2026-09-02",
    metrics: [],
    diagnosis: "<b>不可执行</b>",
    primaryAction: "观察",
    actions: [],
  },
});

assert(!escaped.includes("<script>"));
assert(!escaped.includes('onclick="alert(1)'));
assert(escaped.includes("&lt;script&gt;"));
assert(escaped.includes("商品&amp;名称"));

const sorted = sortPriorityItems([
  { sev: "medium", score: 90, impactValue: 900 },
  { sev: "high", score: 80, impactValue: 800 },
  { sev: "high", score: 100, impactValue: 100 },
  { sev: "high", score: 20, impactValue: 1200 },
]);
assert.deepStrictEqual(sorted.map((item) => item.impactValue), [1200, 800, 100, 900]);

const selected = selectPriorityItems([
  { sev: "high", dedupeKey: "shop:123", impactValue: 900, score: 80, title: "曝光下降" },
  { sev: "high", dedupeKey: "shop:123", impactValue: 900, score: 70, title: "GMV 下降" },
  { sev: "medium", dedupeKey: "shop:456", impactValue: 300, score: 40, title: "点击下降" },
], 8);
assert.deepStrictEqual(selected.map((item) => item.title), ["曝光下降", "点击下降"]);

console.log("priority-card tests passed");
