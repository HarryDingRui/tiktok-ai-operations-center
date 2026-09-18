# 飞书内部智能运营接入设计

## 目标

在“数据接入”页面最下方增加“飞书智能运营接入”，为公司内部自建飞书应用提供真实的连接、测试和状态入口。第一阶段只允许豆包读取经过汇总的经营数据、生成建议，并由飞书人工审批；不得自动修改 TikTok 店铺、商品、广告、达人或视频。

## 真实状态边界

- GitHub Pages 只承担前端展示，不保存飞书 `App Secret`、豆包 `ARK_API_KEY` 或店铺凭据。
- 未填写网关地址时显示“待配置后端”；填写但请求失败时显示具体错误；只有网关返回真实配置状态时才显示“已配置”。
- 前端只持久化网关地址；临时访问令牌仅保存到 `sessionStorage`，关闭浏览器后失效。
- 未配置飞书或豆包凭据时，测试按钮必须返回明确缺项，不得模拟成功。

## 用户界面

模块名称为“飞书智能运营接入”，包含：

1. 总体状态：待配置、部分就绪、只读审批已就绪或连接异常。
2. 四张状态卡：飞书应用、豆包模型、运行模式、审计记录。
3. 清晰的数据流：真实数据 → 豆包分析 → 飞书审批 → 人工执行 → 效果回写。
4. 安全边界：只读分析、人工审批、禁止自动改店、密钥仅在后端。
5. 配置区：网关地址、临时访问令牌、保存配置、检查连接、测试飞书、测试豆包。
6. 操作反馈：显示最近一次请求的真实结果和时间。

## 后端网关

后端位于 `services/feishu-ops-gateway`，使用 Node.js 20+ 原生 API，不引入第三方依赖。

### 环境变量

- `PORT`：监听端口，默认 `8788`。
- `ALLOWED_ORIGINS`：允许访问的前端来源，逗号分隔。
- `OPS_GATEWAY_TOKEN`：前端调用受保护接口时使用的内部访问令牌。
- `FEISHU_APP_ID`、`FEISHU_APP_SECRET`：飞书内部自建应用凭据。
- `FEISHU_RECEIVE_ID`：测试卡片接收目标。
- `FEISHU_RECEIVE_ID_TYPE`：默认 `chat_id`。
- `FEISHU_VERIFICATION_TOKEN`：飞书回调验证令牌。
- `ARK_API_KEY`、`ARK_MODEL`：火山方舟凭据和模型标识。
- `AUDIT_LOG_PATH`：审计日志路径，默认 `data/audit-log.jsonl`。

### 接口

- `GET /health`：进程健康检查，不返回密钥。
- `GET /api/v1/integrations/status`：返回飞书、豆包、模式和审计状态。
- `POST /api/v1/integrations/feishu/test`：向配置目标发送真实测试卡片。
- `POST /api/v1/integrations/doubao/test`：调用真实豆包 Responses API。
- `POST /api/v1/recommendations/analyze`：接收汇总数据，生成结构化建议并可推送飞书卡片。
- `POST /api/v1/integrations/feishu/events`：处理 URL 验证和审批动作回调。

除 `/health` 和飞书事件回调外，接口必须校验 `Authorization: Bearer <OPS_GATEWAY_TOKEN>`。

## 建议数据结构

```json
{
  "id": "rec_...",
  "store": "INSPIRE PURIFY",
  "dateRange": { "start": "2026-09-01", "end": "2026-09-14" },
  "title": "商品转化异常",
  "summary": "曝光稳定但成交下降",
  "evidence": ["商品 ID 173...", "成交件数 15 → 0"],
  "action": "人工复核价格、评价和详情页",
  "risk": "medium",
  "confidence": 0.82,
  "missingData": [],
  "status": "pending_approval"
}
```

## 飞书审批

飞书建议卡片提供“采纳建议”和“驳回”按钮。回调只记录审批状态与操作者，不执行 TikTok 动作。任何自动执行能力必须在未来单独设计、审批和发布。

## 验收

1. 数据接入页最下方能看到完整模块，桌面和移动端布局均可用。
2. 未配置网关时状态真实显示为待配置。
3. 网关本地启动后，状态接口能区分飞书和豆包是否配置。
4. 缺少凭据时测试接口返回可读错误；凭据齐全时调用真实官方 API。
5. 审批回调写入只追加审计日志，不修改运营数据。
6. 前后端测试、语法检查和现有回归测试全部通过。
