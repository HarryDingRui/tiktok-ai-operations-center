# TikTok AI Operations Center Auth Gateway

这是公司内网 Docker 部署使用的会话认证服务，不部署到 GitHub Pages。

## 服务器专用认证配置

在服务器项目目录执行以下命令，按提示输入现有账号。密码只在交互输入时使用，不会写入命令行参数、Git、镜像或日志：

```bash
node services/auth-gateway/scripts/create-auth-config.mjs .secrets/auth-config.json
```

生成文件结构如下，示例值不是可用凭据：

```json
{
  "sessionSecret": "server-only-random-secret",
  "users": {
    "example-user": {
      "algorithm": "scrypt",
      "salt": "base64-salt",
      "passwordHash": "base64-derived-key"
    }
  }
}
```

`.secrets/auth-config.json` 必须留在服务器本地，并通过 Compose 只读挂载到 `/run/secrets/auth-config.json`。不要把它复制到 GitHub、Docker build context、截图或聊天记录中。

## HTTP 接口

- `GET /health`：服务健康检查。
- `POST /api/auth/login`：校验账号密码并签发 HttpOnly 会话 Cookie。
- `POST /api/auth/logout`：清除会话 Cookie。
- `GET /api/auth/session`：返回当前会话用户。
- `GET /api/auth/verify`：供 Nginx `auth_request` 使用。

服务默认监听 `8789`，由 Nginx 内部代理访问，不直接暴露宿主机端口。
