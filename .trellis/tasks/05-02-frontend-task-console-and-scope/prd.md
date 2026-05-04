# frontend: 任务控制台、澄清确认与资产范围

## Goal

实现智能网络安全分析平台前端的核心交互入口（首版）：自然语言任务创建、澄清问题与回答、计划预览、确认执行、任务列表与任务详情核心状态、资产组与白名单范围管理、待确认资产队列。同时搭建 React 应用壳（路由、Providers、MSW、auth context、layout）作为后续兄弟前端任务的基座。

后端不存在 HTTP 层；本任务全程由 **MSW + zod 派生的 mock handler** 模拟，handler 响应严格符合现有 backend contracts（`task-execution.contract.ts`、`task-plan.contract.ts`、`asset-authorization.contract.ts`、`asset-discovery.contract.ts`、`actor-context.contract.ts`、`api-error-response.ts`）。

## Users

- **安全工程师**：通过任务控制台输入自然语言、回答澄清、确认计划、查看任务详情。
- **平台管理员 / 安全审计员 / 管理层只读用户**：本任务仅在 actor-switcher / mock login 中提供身份切换；管理员/审计员/管理层专属页面归属兄弟任务。
- **资产组管理员**：管理资产组、白名单、待确认资产 confirm/reject。

## Workspace Layout

```
.
├── src/                         # 后端代码（不变）
└── web/                         # 新增前端 package（独立 package.json + tsconfig）
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.cjs
    ├── index.html
    ├── public/
    └── src/
        ├── app/
        │   ├── router/          # createBrowserRouter, route 表
        │   ├── providers/       # QueryClientProvider, ActorProvider, ToastProvider
        │   ├── layouts/         # AuthenticatedLayout, AnonymousLayout
        │   └── msw/             # browser worker init, handler 索引
        ├── features/
        │   ├── auth/            # mock login 页 + actor 上下文
        │   ├── task-console/
        │   ├── task-list/
        │   ├── task-detail/
        │   └── asset-scope/
        ├── shared/
        │   ├── api/             # fetch helper, zod runtime parser
        │   ├── components/      # StatusBadge, ConfirmationDialog, EmptyState, ErrorState
        │   ├── hooks/           # use-current-actor, use-can-*, use-toast
        │   ├── contracts/       # 镜像后端契约的 zod schema（不直接 import 后端 src/）
        │   ├── auth/            # permission helpers
        │   └── formatting/      # date / intensity / state 文案表
        └── tests/
            ├── unit/
            ├── integration/
            └── e2e/             # （E2E 由后续 integration 任务补，本任务可仅留目录占位）
```

> **契约镜像策略**：`web/src/shared/contracts/*.ts` 复制后端 zod schema（`taskState`、`taskLifecycleStage`、`permissionPoint`、`workflowType`、`taskPlanStep`、`taskRecord`、`assetTarget`、`discoveredAsset`、`actorContext`、`domainErrorCode`），保持字段与 enum 完全一致。后端契约后续若变化，由 cross-layer check 阶段同步。**不直接 path-import 后端 src/**，避免 Node-only 代码（`crypto.randomUUID`、`structuredClone`）渗透到浏览器构建。

## Stack

- **构建**：Vite 5+ / React 18 / TypeScript（strict）
- **路由**：React Router v6（`createBrowserRouter`，loaders 暂不使用，依赖 TanStack Query 取数）
- **服务端状态**：TanStack Query v5
- **样式**：Tailwind CSS + shadcn/ui（按需引入：Button、Card、Dialog、Tabs、Table、Toast、Badge、Form、Input、Textarea、Select、Skeleton）
- **运行时校验**：Zod（与后端 schema 同源）
- **Mock**：MSW v2 浏览器 worker；handler 从 zod schema 派生 fixture
- **测试**：Vitest + React Testing Library（component / integration），E2E 留给整合任务

## Pages (6)

1. **`/login`** — Mock login 表单（用户名 / 角色快捷切换：`security-engineer` / `admin` / `auditor` / `viewer`）。POST `/auth/session` → 返回 `ActorContext`，写入内存 + sessionStorage。
2. **`/`（task-console）** — 自然语言 prompt 输入、提交后展示澄清问题列表 / 计划预览 / YOLO 切换 / 确认执行；按 lifecycleStage 切分渲染分支。
3. **`/tasks`（task-list）** — 当前 actor 可见任务表（filter/sort/page 走 URL state）。列：任务 ID、workflow、强度、`lifecycleStage`、`state`、创建时间、YOLO 标记。
4. **`/tasks/:taskId`（task-detail）** — 步骤时间线、`PARTIAL_SUCCESS` 中失败步骤标红、`BLOCKED` / `NEEDS_CLARIFICATION` / `AWAITING_CONFIRMATION` 显式状态视图、kill switch 按钮（mock）。`lifecycleStage` 不为终态时按 5s 轮询；终态停止轮询。
5. **`/asset-scope`（asset-groups + whitelist）** — 列出资产组、组内 IP/CIDR/域名条目，支持新增条目（仅 `asset_scope:manage` 可见）。
6. **`/asset-scope/discovered`（discovered-asset 待确认队列）** — 列出 `DISCOVERED_PENDING_CONFIRMATION` 资产，支持 confirm / reject 动作。`OUT_OF_SCOPE_DISCOVERED` 仅展示，不允许提升为 confirmed。

## MSW Handler Surface

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/auth/session` | 登录，body=`{username, roleId}`，返回 `ActorContext` |
| GET | `/api/auth/session` | 当前会话；未登录 → 401 |
| DELETE | `/api/auth/session` | 登出 |
| POST | `/api/tasks/intent` | 接收自然语言 prompt → 返回 `{ taskId, lifecycleStage, plan?, clarifications? }`（mock LLM）|
| POST | `/api/tasks` | 创建结构化任务（`CreateTaskCommand`） |
| GET | `/api/tasks` | 任务列表（支持 `assignee`、`workflowType`、`lifecycleStage`、`page`、`pageSize` 查询） |
| GET | `/api/tasks/:taskId` | `TaskRecord` |
| POST | `/api/tasks/:taskId/clarifications/:clarificationId/answer` | 回答澄清 |
| POST | `/api/tasks/:taskId/confirmations` | 提交确认（高强度 / YOLO 边界） |
| POST | `/api/tasks/:taskId/cancel` | kill switch（仅 `task:cancel`） |
| GET | `/api/asset-groups` | 列表 |
| GET | `/api/asset-groups/:groupId` | 详情（含 whitelist entries） |
| POST | `/api/asset-groups/:groupId/whitelist-entries` | 新增条目 |
| GET | `/api/discovered-assets` | 待确认队列；query: `state` |
| POST | `/api/discovered-assets/:assetId/confirm` | 确认入组 |
| POST | `/api/discovered-assets/:assetId/reject` | 拒绝 |

错误响应统一遵循 `api-error-response.ts` 的 `ApiErrorResponse` 形状（`errorCode` ∈ `DomainErrorCode`、`message`、`details`、可选 `taskState`）。

## Domain Hooks (selected)

读：

- `use-current-actor()` — 从 `ActorProvider` 读 `ActorContext`
- `use-can-create-task()` / `use-can-confirm-task()` / `use-can-yolo-execute()` / `use-can-manage-asset-scope()` — 基于 `permissionPoints`
- `use-task-intent-preview()` — `mutate({ prompt })` → 返回结构化 plan + clarifications
- `use-task-detail(taskId)` — 终态前 5s 轮询，终态后停止
- `use-task-list({ filters })` — URL state 同步
- `use-asset-groups()` / `use-asset-group(groupId)`
- `use-discovered-assets({ state })`

写：

- `use-submit-clarification-answer()`
- `use-confirm-task-execution()`（包含高强度 / YOLO 边界判断，返回 `requiresConfirmation`、`canExecute`、`blockedReason`）
- `use-add-whitelist-entry()`
- `use-confirm-discovered-asset()` / `use-reject-discovered-asset()`
- `use-cancel-task()`

## Component Primitives

- `<StatusBadge state={TaskState | TaskLifecycleStage | AssetDiscoveryState}>`：跨页统一徽章，`BLOCKED`、`NEEDS_CLARIFICATION`、`PARTIAL_SUCCESS`、`HIGH`、`YOLO` 词汇统一。
- `<ConfirmationDialog>`：动作描述 + 目标范围 + 风险等级文本（不只图标）。
- `<TaskStepTimeline>`：渲染步骤分支（`PENDING|SUCCESS|FAILED|SKIPPED|CANCELLED`）。
- `<ClarificationList>` / `<TaskPlanPreviewCard>`。
- `<EmptyState>` / `<ErrorState>` / `<UnauthorizedState>`：empty 与 unauthorized 必须分别表达，不能 fallback 为相同空白。

## Type Safety

- `web/src/shared/contracts/*.ts` 用 zod 定义后端契约镜像；运行时 `*.parse()` 校验所有 MSW 响应。
- 所有跨页域类型：`TaskExecutionViewState` 用 discriminated union（`needs_clarification` / `blocked` / `awaiting_confirmation` / `running` / `partial_success` / `success` / `cancelled`）。
- `TaskId`、`AssetGroupId`、`DiscoveredAssetId`：branded type alias。
- 禁止 `any`；后端未知 enum 走 `safeFallbackBadge`，提示 "unknown state"。

## State Boundaries

- **Server state**：所有 task / asset / discovered-asset 列表与详情 → TanStack Query；query key 形如 `['task-detail', taskId]` / `['asset-groups']` / `['discovered-assets', state]`。
- **URL state**：task-list 的 `lifecycleStage`、`workflowType`、`page`、`sort`；discovered-assets 的 `state`。用 zod 解析 search params。
- **Local component state**：dialog 打开/关闭、prompt 输入、清单展开。
- **Global state**：`ActorContext`（React Context，不放 sessionStorage 之外的位置）。
- **Sensitive temporary state**：本任务无（无 cleartext 弱口令、无一次性导出密码）；接口预留 hooks 让兄弟任务使用。

## Decision (ADR-lite)

- **Context**：项目 repo 此前只有 backend，无前端代码、无 HTTP server，且后端服务为 in-process Node service（含 `crypto`、`structuredClone`）。前端 spec 要求按 feature-first 组织、强制 server-state / sensitive-temporary 边界。
- **Decision**：
  - 顶层 `web/` 独立 package，与 `src/` 平行；不引入 npm workspaces（避免迁移已归档后端任务的导入路径）。
  - 不直接 import 后端 src/，改为契约镜像 + zod；MSW handler 在浏览器内提供模拟响应，handler 响应通过同一 schema parse。
  - 路由选 React Router v6，URL state 用 zod parse search params 弥补类型缺口。
- **Consequences**：
  - 后端契约变化时需要前端契约镜像同步；`integration-and-quality-verification` 任务需补一个 `contracts-parity` 检查脚本（diff 后端 zod schema 与前端镜像）。
  - 真实 HTTP server 引入时，仅替换 MSW worker 启用条件（`import.meta.env.DEV` → `false`），不影响 hook 与组件代码。

## Requirements

- **R1**：搭建 `web/` 独立前端 package，能 `npm install`、`npm run dev`、`npm run build`、`npm run typecheck`、`npm run test` 全部通过。
- **R2**：6 个页面均可路由抵达，并通过权限点显式控制可见性 / 可操作性。
- **R3**：MSW worker 在 dev 与 test 环境启用，提供上文 16 条 handler；测试中 handler 可被 per-test override。
- **R4**：所有 MSW 响应必须经 zod schema parse 后再交给组件；解析失败显示恢复性 `unknown state` 视图，而非崩溃。
- **R5**：`TaskExecutionViewState` 用 discriminated union；六类状态各有独立渲染分支与对应组件测试。
- **R6**：高强度（`HIGH`）或 YOLO 边界（`requiresConfirmation=true`）必须先 preview 再 confirm；preview 与 confirm 是分离的两步控件。
- **R7**：未授权动作必须显式呈现"无权限"，不得 fallback 为空表 / 空卡片。
- **R8**：task-detail 在非终态生命周期下按 5 秒轮询 `GET /tasks/:taskId`；终态（`SUCCESS|PARTIAL_SUCCESS|FAILED|BLOCKED|CANCELLED`）停止轮询。
- **R9**：`OUT_OF_SCOPE_DISCOVERED` 资产仅展示、按钮禁用；UI 文案显式标注"超出授权根域，不可纳入扫描范围"。
- **R10**：dev-only actor switcher 切换角色后，`ActorContext` 立即更新，所有 `use-can-*` hook 重新计算可见性。

## Acceptance Criteria

- [ ] `cd web && npm install && npm run typecheck && npm run test && npm run build` 全部通过
- [ ] `npm run dev` 启动后访问 `/login`，可选择 `security-engineer`、`admin`、`auditor`、`viewer` 任一角色登录
- [ ] task-console 输入 prompt → 触发 `/api/tasks/intent` → 渲染澄清问题或计划预览
- [ ] 计划预览中存在 `requiresConfirmation` 步骤时，确认按钮触发 `<ConfirmationDialog>`，dialog 关闭则不执行
- [ ] YOLO 切换后非高风险路径可跳过确认；高强度路径仍强制确认
- [ ] task-detail 渲染 `BLOCKED` / `NEEDS_CLARIFICATION` / `AWAITING_CONFIRMATION` / `RUNNING` / `PARTIAL_SUCCESS` / `SUCCESS` / `CANCELLED` 七类视图，且各有 component test
- [ ] task-list 的 filter / sort / page 出现在 URL，刷新页面后状态保留
- [ ] asset-scope 中 `auditor` / `viewer` 角色看不到"新增白名单条目"按钮
- [ ] discovered-assets 中 `OUT_OF_SCOPE_DISCOVERED` 行的 confirm 按钮禁用并附说明
- [ ] dev actor 切换为 `viewer` 后，task-console 提交按钮变为 disabled 并显示"无 task:create 权限"
- [ ] integration test 覆盖：login → task-console → 澄清 → 计划预览 → 确认执行 → task-detail 完整链路
- [ ] integration test 覆盖：discovered-asset confirm → asset-scope 列表中出现新条目
- [ ] 所有 MSW 响应 unit test 验证 zod parse 通过

## Definition of Done

- 单测 + 集成测试新增 / 更新覆盖 R1–R10 的关键路径
- `npm run typecheck` strict 通过；不引入 `any`
- `npm run lint`（如启用）通过
- frontend spec 中 forbidden patterns 在代码评审清单上自检（无明文敏感渲染、无 status 通用化、无 server-state 复制到全局）
- README（`web/README.md`）说明 dev / test / build 命令、actor switcher 用法、MSW handler override 模式

## Out of Scope

- 真实 HTTP server / 真实 LLM Provider（仍走 MSW + 静态 plan fixture）
- 漏洞 / 弱口令 / 邮件 / 日志分析页面（`05-02-frontend-security-analysis-surfaces`）
- Dashboard / Audit / Admin（`05-02-frontend-dashboard-audit-and-admin`）
- E2E 自动化（`05-02-integration-and-quality-verification`）
- 国际化（中英双语）；UI 文案优先中文，留 i18n 接入点但不接入 lib
- 主题切换、深色模式
- 真实 SSO / OAuth / JWT
- 弱口令明文展示与一次性导出密码（属于其他任务的 sensitive temporary state）
- WebSocket / SSE 实时推送

## Open Questions

无 blocking 项。以下 PRD 中已假设并锁定，如未来需要再开新任务调整：

- 任务详情轮询间隔固定为 5s；后续可由用户偏好覆盖
- shadcn/ui 与 Tailwind v3 vs v4：实施时锁定 Tailwind v3 以匹配 shadcn 当前稳定文档

## Technical Notes

- 后端契约源文件（前端镜像参考）：
  - `src/shared/contracts/foundation.ts`（taskState、permissionPoint、executionIntensity、assetDiscoveryState、domainErrorCode）
  - `src/shared/contracts/api-error-response.ts`
  - `src/modules/auth/contracts/actor-context.contract.ts`
  - `src/modules/asset-scope/contracts/asset-authorization.contract.ts`
  - `src/modules/asset-scope/contracts/asset-discovery.contract.ts`
  - `src/modules/task-planning/contracts/task-plan.contract.ts`
  - `src/modules/task-execution/contracts/task-execution.contract.ts`
- frontend spec：`.trellis/spec/frontend/{index,directory-structure,component-guidelines,hook-guidelines,state-management,type-safety,quality-guidelines}.md`
- 平台 PRD：`.trellis/tasks/05-01-security-analysis-platform-prd/prd.md`
- 父任务 PRD：`.trellis/tasks/05-02-security-analysis-platform-mvp/prd.md`
