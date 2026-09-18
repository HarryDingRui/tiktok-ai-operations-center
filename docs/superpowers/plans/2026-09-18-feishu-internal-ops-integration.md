# Feishu Internal Operations Integration Implementation Plan

**Goal:** Add a truthful Feishu and Doubao integration surface to the data-access page and a runnable internal gateway that supports connection checks, real provider tests, read-only recommendations, Feishu approval callbacks, and append-only audit records.

**Architecture:** Keep the GitHub Pages frontend secret-free and connect it to an independently deployed Node.js gateway. The gateway owns provider credentials, validates an internal bearer token, calls Feishu and Volcengine APIs, and records approvals without executing TikTok changes.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js 20+ built-in `fetch`, `http`, `node:test`, JSON Lines audit storage.

**Spec:** `docs/superpowers/specs/2026-09-18-feishu-internal-ops-integration-design.md`

## Global Constraints

- First release is read-only analysis plus human approval; it must not change TikTok data.
- Provider secrets exist only in backend environment variables.
- Frontend gateway token is session-only and must not be written to localStorage.
- Missing configuration is displayed as missing, never as connected.
- Existing dashboard names, data semantics, imports, and control-plane behavior remain unchanged.

### Task 1: Frontend integration state model

**Files:**
- Create: `tests/feishu-integration.test.js`
- Create: `data/feishu-integration.js`

**Interfaces:**
- Produces: `normalizeGatewayUrl(value)`, `deriveIntegrationView(status, hasEndpoint)`, `createGatewayClient(options)`.

- [x] Write tests for URL normalization, truthful unconfigured/partial/ready/error states, bearer headers, and error propagation.
- [x] Run `node tests/feishu-integration.test.js` and confirm it fails because the module is absent.
- [x] Implement the minimal UMD-compatible state model and gateway client.
- [x] Re-run the test and confirm it passes.

### Task 2: Backend provider adapters and recommendation schema

**Files:**
- Create: `services/feishu-ops-gateway/test/providers.test.js`
- Create: `services/feishu-ops-gateway/src/config.js`
- Create: `services/feishu-ops-gateway/src/feishu.js`
- Create: `services/feishu-ops-gateway/src/doubao.js`
- Create: `services/feishu-ops-gateway/src/recommendations.js`

**Interfaces:**
- Produces: `loadConfig(env)`, `createFeishuClient(options)`, `createDoubaoClient(options)`, `normalizeRecommendation(value, context)`, `buildRecommendationCard(recommendation)`.

- [x] Write provider tests using injected fetch functions for missing configuration, real request shape, response parsing, safe card rendering, and recommendation validation.
- [x] Run `node --test services/feishu-ops-gateway/test/providers.test.js` and confirm it fails because modules are absent.
- [x] Implement provider adapters and schema normalization without dependencies.
- [x] Re-run provider tests and confirm they pass.

### Task 3: Gateway routes, authorization, callbacks, and audit

**Files:**
- Create: `services/feishu-ops-gateway/test/server.test.js`
- Create: `services/feishu-ops-gateway/src/audit-store.js`
- Create: `services/feishu-ops-gateway/src/app.js`
- Create: `services/feishu-ops-gateway/src/server.js`
- Create: `services/feishu-ops-gateway/package.json`
- Create: `services/feishu-ops-gateway/.env.example`
- Create: `services/feishu-ops-gateway/README.md`

**Interfaces:**
- Produces: `createApp(dependencies)` request handler and documented environment contract.

- [x] Write route tests for health, authorization, status, missing provider configuration, URL verification, approval logging, and no TikTok mutation route.
- [x] Run `node --test services/feishu-ops-gateway/test/server.test.js` and confirm it fails because the app is absent.
- [x] Implement the HTTP application, JSON parsing, CORS allowlist, audit store, server entrypoint, and operational documentation.
- [x] Re-run server tests and confirm they pass.

### Task 4: Data-access page UI

**Files:**
- Create: `data/feishu-integration.css`
- Modify: `data/feishu-integration.js`
- Modify: `index.html`
- Create: `tests/feishu-integration-shell.test.js`

**Interfaces:**
- Consumes: frontend state model and gateway client from Task 1.
- Produces: responsive configuration, status, safety, and test controls under `#feishu-ops-integration`.

- [x] Write the shell test for placement at the bottom of `#page-data`, required labels, script/style versions, and absence of hard-coded secrets.
- [x] Run `node tests/feishu-integration-shell.test.js` and confirm it fails because the shell is absent.
- [x] Add the semantic HTML and responsive stylesheet; bind status and test controls.
- [x] Re-run the shell and frontend tests and confirm they pass.

### Task 5: Full verification and publication preparation

**Files:**
- Modify only if verification reveals a regression.

- [x] Run every `tests/*.test.js` file and `tests/test-video-navigation-shell.ps1`.
- [x] Run gateway tests through `npm test`.
- [x] Run `node --check` on every new JavaScript file.
- [x] Start the gateway with empty provider credentials and verify `/health` and the truthful status response.
- [x] Serve the site locally and inspect the integration module in a browser.
- [x] Run `git diff --check` and review the complete diff for secrets and unrelated changes.


## Verification Note

- Local browser inspection confirmed the module is visible at the bottom of the data-access page, reads the live local gateway status, and shows provider configuration errors instead of false success.

