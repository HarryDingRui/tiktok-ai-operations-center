# 三域操盘中心 · GitHub 本地版

独立部署在现有 GitHub Pages 仓库子目录中的小红书、抖音、闲鱼账号运营操盘系统。

## 数据边界

- 页面默认不包含真实账号或经营数据。
- CSV 与 JSON 在当前浏览器内解析，不会自动上传 GitHub 或第三方服务器。
- 账号、快照、任务、预警处理状态保存在当前浏览器 `localStorage`。
- 未提供的指标显示“待导入”；CSV 中明确填写的 `0` 保持为真实零。
- GitHub Pages 是静态站，无法提供安全登录、多人同步、D1 审计和后台定时采集。
- 多人协作、权限、审批与服务端审计仍使用私有动态版。

## 本地运行

```powershell
python -m http.server 8765 --directory .
```

打开 `http://127.0.0.1:8765/three-platform-ops-center/#overview`。

## CSV 模板

- `templates/xiaohongshu-pilot.csv`
- `templates/douyin-pilot.csv`
- `templates/xianyu-pilot.csv`

导入前先登记账号，模板中的 `account_ref` 必须与登记的账号编号完全一致。
