# 飞书内部智能运营网关

该服务把静态 GitHub Pages 与公司内部飞书应用、豆包模型连接起来。当前模式固定为“只读分析 + 人工审批”，没有 TikTok 写入接口。

## 运行要求

- Node.js 20 或更高版本
- 公司内部飞书自建应用
- 火山方舟已启用的模型或推理接入点
- 可被飞书访问的 HTTPS 回调地址

## 配置

复制 `.env.example` 中的字段到部署平台的环境变量。不要把真实密钥写入 `.env.example`、Git 或前端代码。

关键配置：

- `ALLOWED_ORIGINS` 必须包含 `https://harrydingrui.github.io`。
- `OPS_GATEWAY_TOKEN` 使用长度至少 32 字符的随机值；网页只在当前浏览器会话中保存它。
- 飞书事件回调地址为 `https://你的网关域名/api/v1/integrations/feishu/events`。
- 测试卡片默认发送到 `FEISHU_RECEIVE_ID` 指定的群聊或用户。

PowerShell 本地启动示例：

```powershell
$env:PORT='8788'
$env:ALLOWED_ORIGINS='http://127.0.0.1:8000'
$env:OPS_GATEWAY_TOKEN='使用你自己的长随机令牌'
node .\src\server.js
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8788/health
```

状态检查：

```powershell
$headers = @{ Authorization = 'Bearer 使用你自己的长随机令牌' }
Invoke-RestMethod http://127.0.0.1:8788/api/v1/integrations/status -Headers $headers
```

## 测试

```powershell
npm test
```

测试使用注入的 HTTP 客户端，不会调用真实飞书或豆包，也不会产生费用。

## 安全边界

- 飞书和豆包密钥只存在于后端环境变量。
- 审批回调只追加审计日志。
- 服务不包含修改 TikTok 广告预算、价格、商品状态或达人消息的接口。
- 上线时必须使用 HTTPS，并将网关限制为公司允许的前端来源。
