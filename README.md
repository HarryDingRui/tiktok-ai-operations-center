# TikTok AI智能运营中控台

这是一个可直接放入 GitHub 仓库并部署到 GitHub Pages 的静态网站。

## 当前功能

- 全部店铺、单个店铺筛选
- 销量 Top5、全店 GMV Top5、GMV 上涨 Top5、GMV 下降 Top5、CVR 下降 Top5
- 运营动作有效性验证
- 运营已执行清单
- 日报闭环、商品排行、数据导入
- WPS/Kdocs 运营填报模板（`data/tiktok-ai-operations-center-wps-kdocs-template.xlsx`）
- CSV 数据仅在当前浏览器处理，不会自动上传服务器

## 部署到 GitHub Pages

1. 新建一个 GitHub 仓库。
2. 将本目录全部文件上传到仓库的 `main` 分支。
3. 打开仓库 `Settings → Pages`。
4. 将发布来源设置为 `GitHub Actions`。
5. 推送代码后，工作流会自动发布网站。

仓库已经包含 `.github/workflows/deploy-pages.yml`，不需要额外构建命令。

## 数据与登录说明

当前版本是纯静态 GitHub Pages 网站，默认使用演示数据，也支持在浏览器内导入真实 CSV。GitHub Pages 本身不提供安全的账号密码验证；如果后续需要真实登录，需要再接入带后端认证的部署方式，不能把密码直接写入 HTML。

## WPS/Kdocs 填报

运营人员优先使用 `data/tiktok-ai-operations-center-wps-kdocs-template.xlsx`，上传到 WPS/Kdocs 后填写黄色区域。模板包含店铺日汇总、商品数据、运营动作已执行清单、发布趋势、BD 达人、广告计划和短视频数据等工作表。

当前 GitHub Pages 仍读取 `data/operations-data.json` 作为网站发布数据。WPS/Kdocs 填写完成后，需要导出对应 CSV 或将整理后的数据更新到发布数据源，再点击网站“同步网站数据”；静态网页不会直接读取私有 WPS/Kdocs 文档。
