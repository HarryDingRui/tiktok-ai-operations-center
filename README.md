# TikTok AI智能运营中控台

这是主管提供的 `tiktok_dashboard.html` v3（Agent Native）版本，已封装为可直接放入 GitHub 仓库并部署到 GitHub Pages 的静态网站。

## 当前功能

- 全部店铺、单个店铺筛选
- 销量 Top5、全店 GMV Top5、GMV 上涨 Top5、GMV 下降 Top5、CVR 下降 Top5
- 运营动作有效性验证
- 运营已执行清单
- 商品数据预警（T+1/T+3/T+7）
- 自营短视频与商品数据合并查看
- 运营知识库与有效动作沉淀
- Agent 调度中心
- 数据接入界面
- WPS/Kdocs 运营填报模板（`data/tiktok-ai-operations-center-wps-kdocs-template.xlsx`）
- CSV 数据仅在当前浏览器处理，不会自动上传服务器
- 数据接入页提供 WPS/Kdocs 模板下载和字段说明入口

## 部署到 GitHub Pages

1. 新建一个 GitHub 仓库。
2. 将本目录全部文件上传到仓库的 `main` 分支。
3. 打开仓库 `Settings → Pages`。
4. 将发布来源设置为 `GitHub Actions`。
5. 推送代码后，工作流会自动发布网站。

仓库已经包含 `.github/workflows/deploy-pages.yml`，不需要额外构建命令。

## 数据与登录说明

当前 v3 主页面使用 HTML 内置演示数据，页面内的 Agent 调度、预警和数据接入按钮是演示交互；GitHub Pages 本身不提供安全的账号密码验证。后续接入真实云文档、店铺筛选和登录权限，需要把数据层和认证层接到后端，不能把密码直接写入 HTML。

## WPS/Kdocs 填报

运营人员优先使用 `data/tiktok-ai-operations-center-wps-kdocs-template.xlsx`，上传到 WPS/Kdocs 后填写黄色区域。模板包含店铺字典、店铺日汇总、商品数据、五组链接对比排行、预警规则、运营动作已执行清单、发布趋势、BD 达人、广告计划、短视频数据、运营知识库、Agent 调度和字段字典等工作表。

`data/operations-data.json` 和 WPS/Kdocs 模板作为后续数据接入资产保留；当前 v3 页面不会自动读取私有 WPS/Kdocs 文档或 JSON。要让真实数据驱动页面，需要增加后端同步/API，并把页面内置演示数据替换为接口数据。
