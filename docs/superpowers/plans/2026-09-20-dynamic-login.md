# TikTok AI 运营中心动态登录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为公司内网 Docker 部署增加一个动态、可定制的运营中枢登录页，并以服务端会话认证替换 Nginx Basic Auth，同时保持 GitHub Pages 和现有中控台业务不变。

**Architecture:** 登录页由 Nginx 提供静态文件，认证请求代理到只在 Docker 内网可访问的 Node.js `auth-gateway`。认证服务使用 Node 原生 `crypto.scrypt` 校验服务器 secret 文件中的用户哈希，并签发 HttpOnly 会话 Cookie；Nginx 通过 `auth_request` 保护现有静态中控台。GitHub Pages 继续只提供静态页面，不承担真实认证。

**Tech Stack:** Nginx Alpine、Node.js 20+ 原生 HTTP/crypto、Node `node:test`、原生 HTML/CSS/JavaScript、Docker Compose。

**Spec:** `docs/superpowers/specs/2026-09-20-dynamic-login-design.md`

## Global Constraints

- 不修改现有中控台业务 UI 和业务逻辑。
- 不把密码、会话密钥、飞书凭据或其他 secret 写入 GitHub、镜像、前端源码、Compose 或日志。
- 认证服务不引入不必要的第三方运行时依赖。
- GitHub Pages 保持现有静态路径和相对资源兼容。
- `/healthz` 和认证服务 `/health` 不要求登录。
- 动画必须支持 `prefers-reduced-motion: reduce`，并且不能阻塞登录表单。
- 每个逻辑任务完成后运行该任务的测试，再提交独立 commit。

---

### Task 1: 建立认证凭据与会话核心

**Files:**
- Create: `services/auth-gateway/package.json`
- Create: `services/auth-gateway/src/config.js`
- Create: `services/auth-gateway/src/auth.js`
- Create: `services/auth-gateway/test/auth.test.js`
- Create: `services/auth-gateway/README.md`

**Interfaces:**
- `loadConfig(env, readFile)` returns `{ port, authConfigFile, cookieName, sessionTtlSeconds, cookieSecure }`.
- `loadAuthConfig(path, readFile)` returns `{ sessionSecret, users }` without exposing plaintext passwords.
- `verifyPassword(password, record)` returns a boolean using `crypto.scrypt` and `timingSafeEqual`.
- `createSessionToken(username, secret, now, ttlSeconds)` returns a signed opaque token.
- `verifySessionToken(token, secret, now)` returns `{ username, expiresAt }` or `null`.
- `parseCookies(header)` returns a plain cookie map; `serializeSessionCookie(...)` and `serializeClearedCookie(...)` return `Set-Cookie` values.

- [ ] **Step 1: Write failing unit tests for password and session behavior.**

  Cover these exact cases in `auth.test.js`:

  ```js
  test('accepts the configured password and rejects a wrong password', async () => {
    const record = await createPasswordRecord('correct-password', 'fixed-salt');
    assert.equal(await verifyPassword('correct-password', record), true);
    assert.equal(await verifyPassword('wrong-password', record), false);
  });

  test('rejects an expired or tampered session token', () => {
    const token = createSessionToken('Harry', 'test-secret', 1000, 3600);
    assert.deepEqual(verifySessionToken(token, 'test-secret', 2000).username, 'Harry');
    assert.equal(verifySessionToken(token, 'test-secret', 5000), null);
    assert.equal(verifySessionToken(`${token}x`, 'test-secret', 2000), null);
  });

  test('serializes an HttpOnly SameSite session cookie without the password', () => {
    const cookie = serializeSessionCookie('token-value', { secure: false, maxAge: 3600 });
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.doesNotMatch(cookie, /password|correct-password/);
  });
  ```

- [ ] **Step 2: Run the focused test and verify it fails for missing auth primitives.**

  Run: `node --test services/auth-gateway/test/auth.test.js`

  Expected: FAIL because `auth.js` does not yet export the required functions.

- [ ] **Step 3: Implement the minimal native crypto primitives.**

  Use `crypto.scrypt` with fixed parameters `N=16384`, `r=8`, `p=1`, a per-user salt, and a 32-byte derived key. Store only `{ algorithm: "scrypt", salt, passwordHash }` in the server-only config. Sign the session payload with HMAC-SHA256 and encode it as URL-safe base64; reject malformed, expired, or signature-mismatched tokens before returning a username.

- [ ] **Step 4: Run the focused test and verify it passes.**

  Run: `node --test services/auth-gateway/test/auth.test.js`

  Expected: all focused auth primitive tests pass with zero failures.

- [ ] **Step 5: Document the server-only secret format without any real credentials.**

  Document the JSON shape, the one-time hash generation command, the fact that `.secrets/auth-config.json` is never committed, and the current account migration rule. Do not place any current password in the README or example file.

- [ ] **Step 6: Commit the isolated auth core.**

  ```bash
  git add services/auth-gateway/package.json services/auth-gateway/src/config.js services/auth-gateway/src/auth.js services/auth-gateway/test/auth.test.js services/auth-gateway/README.md
  git commit -m "feat: add session authentication primitives"
  ```

### Task 2: Add the authentication HTTP service

**Files:**
- Create: `services/auth-gateway/src/app.js`
- Create: `services/auth-gateway/src/server.js`
- Create: `services/auth-gateway/test/app.test.js`
- Modify: `services/auth-gateway/src/config.js`

**Interfaces:**
- `createAuthApp({ config, authConfig, clock })` returns `{ handle(request) }`.
- `POST /api/auth/login` accepts JSON `{ username, password }` and returns `200 { ok: true, user }` with a session cookie, or `401 { ok: false, error: "账号或密码错误" }`.
- `POST /api/auth/logout` returns `200 { ok: true }` and clears the session cookie.
- `GET /api/auth/session` returns the current user or `401`.
- `GET /api/auth/verify` returns `204` and `X-Authenticated-User` for a valid cookie, otherwise `401` for Nginx `auth_request`.
- `GET /health` returns `200 { ok: true, service: "auth-gateway" }` without authentication.

- [ ] **Step 1: Write failing HTTP behavior tests.**

  In `app.test.js`, instantiate `createAuthApp` with a test config and a deterministic clock. Assert that:

  ```js
  test('login issues a session and session endpoint recognizes it', async () => {
    const login = await request(app, 'POST', '/api/auth/login', { username: 'Harry', password: 'correct-password' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);

    const session = await request(app, 'GET', '/api/auth/session', null, { cookie });
    assert.deepEqual(await session.json(), { authenticated: true, user: 'Harry' });
  });

  test('wrong credentials and missing verification cookie are rejected', async () => {
    const login = await request(app, 'POST', '/api/auth/login', { username: 'Harry', password: 'wrong-password' });
    assert.equal(login.status, 401);
    const verify = await request(app, 'GET', '/api/auth/verify');
    assert.equal(verify.status, 401);
  });

  test('logout clears the session cookie', async () => {
    const logout = await request(app, 'POST', '/api/auth/logout');
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  });
  ```

- [ ] **Step 2: Run the HTTP tests and verify the expected red state.**

  Run: `node --test services/auth-gateway/test/app.test.js`

  Expected: FAIL because `app.js` and its route handlers do not yet exist.

- [ ] **Step 3: Implement the route handler and request body limits.**

  Enforce `Content-Type: application/json`, cap request bodies at 16 KB, parse JSON safely, return generic authentication errors, and never log request bodies or passwords. Set `Cache-Control: no-store` on authentication responses. Implement `server.js` with a 512 KB total request cap, Node's native HTTP server, and graceful shutdown.

- [ ] **Step 4: Run the HTTP tests and the existing gateway tests.**

  Run:

  ```bash
  node --test services/auth-gateway/test/app.test.js
  npm --prefix services/feishu-ops-gateway test
  ```

  Expected: auth HTTP tests and all existing Feishu gateway tests pass.

- [ ] **Step 5: Commit the auth service.**

  ```bash
  git add services/auth-gateway/src services/auth-gateway/test/app.test.js
  git commit -m "feat: add internal auth gateway"
  ```

### Task 3: Build the dynamic login experience

**Files:**
- Create: `login.html`
- Create: `login.css`
- Create: `login.js`

**Interfaces:**
- The page is reachable at `/login` and `/login.html` in the Docker deployment.
- `login.js` calls same-origin `/api/auth/session`, `/api/auth/login`, and `/api/auth/logout`.
- No page code writes passwords or session tokens to `localStorage` or `sessionStorage`.

- [ ] **Step 1: Create semantic, accessible login markup.**

  Add a real `<form>` with labels, username/password inputs, password visibility control, an explicit submit button, a live status region with `aria-live="polite"`, a `noscript` message, and a `next` return path read from the URL. Keep all copy in the approved Chinese terminology: `运营中枢登录`, `进入运营中枢`, `内网安全认证通道`.

- [ ] **Step 2: Add the visual system and motion states.**

  Use the existing dashboard palette as tokens: near-black navy base, cyan primary action, orange warning, green success. Build the background with CSS radial light fields, a small set of positioned data nodes, and a slow scan ring; do not use external images, fonts, CDN assets, decorative stripe backgrounds, or infinite card movement. Add `@media (prefers-reduced-motion: reduce)` to disable nonessential animation.

- [ ] **Step 3: Implement interaction state transitions.**

  On load, call `/api/auth/session`; if already authenticated, redirect to a sanitized same-origin `next` path or `/`. On submit, disable the button, show `正在验证访问权限...`, call `POST /api/auth/login` with JSON, then redirect after success. Map 401, 5xx, network failures, and empty fields to readable status text. The password visibility control changes only the input type and never copies the value.

- [ ] **Step 4: Run static syntax and resource checks.**

  Run:

  ```bash
  node --check login.js
  Select-String -Path login.html,login.css,login.js -Pattern 'http://|https://|password|secret|token' -CaseSensitive:$false
  ```

  Expected: JavaScript syntax check passes; no external URL or hard-coded secret is present. The word `password` may appear only in labels, input names, and error handling—not as a credential value.

- [ ] **Step 5: Commit the login page.**

  ```bash
  git add login.html login.css login.js
  git commit -m "feat: add animated operations center login page"
  ```

### Task 4: Replace Docker Basic Auth with the session boundary

**Files:**
- Create: `services/auth-gateway/Dockerfile`
- Modify: `Dockerfile`
- Modify: `nginx.conf`
- Modify: `docker-compose.yml`
- Modify: `.dockerignore`
- Modify: `.gitignore`

**Interfaces:**
- Nginx serves login assets without auth, proxies `/api/auth/*` to `auth-gateway:8789`, and uses an internal `/__auth_verify` subrequest for all other site content.
- `auth-gateway` is not published to the host; only Nginx publishes `8080:80`.
- Server-only `./.secrets/auth-config.json` is mounted read-only at `/run/secrets/auth-config.json`.

- [ ] **Step 1: Add the auth service image and secret mount.**

  Use `node:20-alpine`, copy only the auth service package and source, run as the non-root `node` user, expose no host port, and add a healthcheck against `/health`. Add the auth service to Compose with `restart: unless-stopped`, `depends_on` health gating for Nginx, and a read-only secret mount. Remove the active `.htpasswd` mount from the normal service while keeping the existing Basic Auth configuration available in Git history for rollback.

- [ ] **Step 2: Write Nginx routing rules.**

  Add public locations for `/login`, `/login.html`, `/login.css`, `/login.js`, and `/api/auth/*`. Add an internal auth subrequest location:

  ```nginx
  location = /__auth_verify {
      internal;
      proxy_pass http://auth_gateway/api/auth/verify;
      proxy_pass_request_body off;
      proxy_set_header Content-Length "";
      proxy_set_header Cookie $http_cookie;
  }
  ```

  Protect the existing `/` content with `auth_request /__auth_verify`; use an internal 302 redirect to `/login?next=...` for browser page requests, retain `401` for auth API failures, and keep `/healthz` open. Preserve current gzip, MIME, index no-cache, static cache, and SPA fallback rules.

- [ ] **Step 3: Extend the static Docker image with login assets.**

  Copy `login.html`, `login.css`, and `login.js` into the Nginx document root. Do not copy `services/auth-gateway`, `.secrets`, tests, or docs into the static image.

- [ ] **Step 4: Validate Compose and Nginx configuration before build.**

  Run:

  ```bash
  docker compose config
  docker build -f services/auth-gateway/Dockerfile services/auth-gateway
  ```

  Expected: Compose renders without secret values, and the auth image builds successfully.

- [ ] **Step 5: Commit the Docker authentication boundary.**

  ```bash
  git add services/auth-gateway/Dockerfile Dockerfile nginx.conf docker-compose.yml .dockerignore .gitignore
  git commit -m "feat: protect internal site with session auth"
  ```

### Task 5: Run full verification and deploy safely

**Files:**
- Modify: `docs/superpowers/specs/2026-09-20-dynamic-login-design.md` only if verified behavior reveals an actual design correction.
- No source changes are allowed during this task unless a failed verification identifies a concrete defect.

- [ ] **Step 1: Run the complete local verification set.**

  Run:

  ```bash
  node --test services/auth-gateway/test/*.test.js
  npm --prefix services/feishu-ops-gateway test
  node --check login.js
  docker compose config
  docker compose up -d --build
  docker compose ps
  Invoke-WebRequest http://127.0.0.1:8080/healthz
  Invoke-WebRequest -MaximumRedirection 0 http://127.0.0.1:8080/ -ErrorAction SilentlyContinue
  docker compose logs --no-color --tail=100
  ```

  Expected: auth and existing gateway tests pass; `/healthz` is 200; unauthenticated `/` redirects to `/login`; no service logs contain passwords or session tokens.

- [ ] **Step 2: Perform browser-level checks.**

  Use the local Docker URL to verify the rendered login page, desktop/mobile layout, reduced-motion behavior, keyboard submission, wrong-password feedback, successful redirect, refresh persistence, logout, and direct navigation to an existing dashboard route. Capture one desktop and one mobile screenshot for review.

- [ ] **Step 3: Back up the server auth configuration before deployment.**

  On `172.16.6.68`, copy the current Nginx/Compose files and `.secrets/htpasswd` to a timestamped server-only backup directory. Do not print file contents or passwords in terminal output.

- [ ] **Step 4: Push the verified source and deploy the new Compose stack.**

  Push the commits to the existing GitHub repository. On the internal server, run `git pull` and `docker compose up -d --build`; do not put any secret in a Git command, commit, image, or shell history.

- [ ] **Step 5: Verify the internal deployment and rollback readiness.**

  Check `docker compose ps`, `/healthz`, unauthenticated redirect, valid login using the existing server-only accounts, invalid login, logout, and dashboard access. If the authentication boundary fails, restore the timestamped Nginx/Compose backup and run `docker compose up -d --build` to return to Basic Auth.

- [ ] **Step 6: Commit only deployment documentation if needed.**

  ```bash
  git status --short
  git log --oneline -6
  ```

  Do not commit server secrets, screenshots containing credentials, generated session files, or `.secrets`.
