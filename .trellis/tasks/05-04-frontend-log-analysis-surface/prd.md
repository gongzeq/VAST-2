# frontend: 日志事件流与攻击趋势

## Goal

实现防火墙 / Web 日志分析师界面：**事件流页**（脱敏结构化事件按时间序展示 + 多维 filter）+ **攻击趋势页**（基于 `AttackTrendBucket` 的窗口聚合 + 文本摘要）。沿用 vuln / mail 子任务确立的 4 域共享 pattern：URL state、viewer 路由级阻止、MSW handler 在 mock 层做查询过滤。

本子任务的独特挑战与硬约束：

1. **后端 query 强制 `assetGroupId`**：不存在"跨 asset group 的全局日志视图"——`SecurityLogEventQuery` 与 `AttackTrendQuery` 的 `assetGroupId` 都是必填。UX 必须先让用户选定一个 asset group
2. **`redactedFields[]` 显式标注**：每条事件可能携带 N 个被脱敏的字段（如 `srcIp`、`uriPath`），UI 必须在对应单元格显式标注 "masked"，禁止把脱敏 null 当成"空值"渲染
3. **原始日志正文不存在于前端任何字节**：后端 `rawBodyDiscarded` 在接收层完成；前端永远不应有"查看原文"动作或缓存
4. **趋势页不依赖纯图表**：父平台 PRD §"dashboard 提供文本摘要，不依赖纯图表表达关键状态"——本任务的趋势页必须**文本摘要为主**，图表为辅

## What I already know

### 后端契约

来源：`src/modules/log-ingestion/contracts/log-ingestion.contract.ts` + `log-repository.contract.ts`

核心 schema：

- `logTypeSchema` — `FIREWALL` / `WAF` / `WEB`
- `ingestProtocolSchema` — `SYSLOG_UDP` / `SYSLOG_TCP` / `SYSLOG_TLS` / `HTTP`
- `parserFormatSchema` — `JSON` / `NGINX_ACCESS` / `APACHE_ACCESS`
- `securityLogSeveritySchema` — `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `INFO`（5 级，与 vulnerability severity 同型异源——前端不复用同一 enum，单独镜像）
- `parseStatusSchema` — `PARSED` / `FAILED`
- `redactionStatusSchema` — `NOT_REQUIRED` / `REDACTED` / `FAILED`
- `normalizedSecurityLogEventSchema`（事件流核心）：
  - 标识：`eventId`、`ingestRef`、`sourceId`、`assetGroupId`、`logType`
  - 时间：`eventTime`（原始）、`receivedAt`（接收）
  - 通讯：`srcIp` / `srcPort` / `dstIp` / `dstDomain` / `dstPort` / `protocol`（全部 nullable）
  - 处置：`action` / `ruleId` / `ruleName`（全部 nullable）
  - 风险：`severity`（必填）、`targetAssetId`（nullable）、`targetAuthorized`（boolean，**重要**：用于显式渲染"目标已授权 / 未授权"）
  - 分类：`classification: { attackType, classificationRuleId, confidence (0-1), explanation } | null`
  - Web 专属：`webFields: { httpMethod, uriPath, statusCode, userAgentSummary, requestSize, responseSize } | null`（非 WEB 日志为 null）
  - 脱敏：`redactedFields: string[]`（被脱敏字段名列表，UI 必须显式渲染 "masked"）
- `attackTrendBucketSchema`（趋势核心）：`bucketId`、`assetGroupId`、`windowStart`、`windowEnd`、`logType`、`attackType`（字符串，由后端规则产生）、`severity`、`srcIpOrCidr` / `targetAssetId` / `action`（nullable）、`eventCount`
- `logSourceConfigSchema`（详情页可链跳）：`sourceId`、`logType`、`productType`、`ingestProtocol`、`parserFormat`、`assetGroupId`、`enabled`、`retentionEventsDays`、`retentionAggregatesDays`

### 后端 Query 维度（决定 MSW handler shape）

- `SecurityLogEventQuery`：`assetGroupId`（**必填**）/ `logType?` / `sourceId?` / `since?` / `until?` / `limit?`
- `AttackTrendQuery`：`assetGroupId`（**必填**）/ `logType?` / `since?` / `until?` / `limit?`

→ UX 必须先选 asset group；URL state 的 `assetGroupId` 是 mandatory key。

### 父级 Tracker 共享约束

详见 `.trellis/tasks/05-02-frontend-security-analysis-surfaces/prd.md`：
- 契约镜像到 `web/src/shared/contracts/log-ingestion.contract.ts`，不直接 import 后端 src/
- 所有 MSW 响应必经 zod parse；解析失败 → unknown state 视图
- 列表 filter / sort / pagination 走 URL state；时间窗口同
- 共享视觉语汇 + `<UnauthorizedState>` / `<EmptyState>` / `<ErrorState>` 严格区分
- 4 域共享 pattern：viewer 路由级阻止、auditor / security-engineer 进入页面后字段完整可见

### 角色权限边界（已锁定）

- `security-engineer`：可查看授权资产组内的日志事件 + 攻击趋势
- `auditor`：只读，可查看完整事件流（含 `classification.explanation` 等审计相关字段）
- `viewer`（管理层）：**路由级阻止**。`/logs/events` 与 `/logs/trends` 对 viewer 直接 403 重定向（platform PRD §3"管理层不得查看敏感原始输出、工具原始输出"——脱敏事件流虽不含 raw body 但仍含资产 IP / 攻击行为，归"原始输出"范畴）；viewer 的日志大屏由 dashboard 任务承担
- 资产组 scope：URL `assetGroupId` 必须在当前 actor 可见列表内；越权访问 → 403
- 共享权限点：`raw_evidence:view`（auditor / security-engineer 默认拥有，viewer 不拥有 → 等同路由级阻止）；`log_event:export` 是独立权限点但**本任务不实现导出**（归 dashboard / report）

### 兄弟任务依赖

- 必须等 `05-02-frontend-task-console-and-scope` 完成壳层之后才能落地
- 复用 vuln / mail 子任务的 `<StatusBadge>` / `<UnauthorizedState>` / `<EmptyState>` / `<ErrorState>`
- brainstorm + jsonl 阶段可并行进行

## Pages

1. **`/logs/events`** — 脱敏安全事件流
   - **必选 URL key**：`assetGroupId`（缺失 → 重定向到默认 group 或显式提示选择）
   - filter（URL state，与后端 query 对齐）：`assetGroupId` / `logType` / `sourceId` / `since` / `until`
   - 默认时间窗口：最近 24 小时（`since` 默认 `now - 24h`，`until` 不设）；URL 显式承载
   - sort：`eventTime` 倒序（默认）/ `severity` / `receivedAt`
   - pagination：URL `page` / `pageSize`（默认 50；事件密度高，pageSize 适当大）
   - 每行（与 `normalizedSecurityLogEventSchema` 对齐）：
     - `severity` 徽章
     - `eventTime`（相对时间）
     - `logType` 角标（`FIREWALL` / `WAF` / `WEB`）
     - `srcIp` / `srcPort` → `dstIp`/`dstDomain` / `dstPort`（每个字段若在 `redactedFields[]` 内则渲染 `<MaskedCell label="srcIp 已脱敏" />`，**禁止**把 null 当空字符串）
     - `protocol` / `action`
     - `classification.attackType`（若非 null）；null → "无分类"
     - `targetAuthorized`：true → "授权目标"小标；false → "未授权目标"红色小标（这是攻击的关键指示）
     - `redactedFields[]` 计数：行尾"N 字段已脱敏"小标 + tooltip 列出字段名
   - **Web 行扩展**：`logType === 'WEB'` 时展开第二行展示 `webFields`（method / uriPath / statusCode）
   - 行点击展开：显示 `classification.explanation` + `ruleId/ruleName` + `userAgentSummary`（不进新页面，避免 N+1 查询）
2. **`/logs/trends`** — 攻击趋势聚合面板
   - **必选 URL key**：`assetGroupId`
   - filter（URL state）：`assetGroupId` / `logType` / `since` / `until`
   - 默认时间窗口：最近 7 天
   - **主区域**：**文本摘要列表**（不靠纯图表），按 `attackType` 分组，每组：
     - "**SQL 注入** — 最近 7 天命中 1,234 次，来自 8 个源 IP / IP 段，命中 3 个授权资产 + 2 个未授权目标"
     - "**XSS** — 最近 7 天命中 312 次，..."
     - 数据来源：MSW handler 在 mock 层 group `attackTrendBucketSchema` by `attackType`，sum `eventCount`，distinct count `srcIpOrCidr` / `targetAssetId`
   - **辅助可视化**：每组下方一条**水平柱图**（`attackType` × `eventCount` 总量对比，所有组共享 X 轴）；不展示时间序列折线图（避免"纯图表表达关键状态"）
   - 严重度分布徽章：每组旁标示该 attackType 的最高 severity（CRITICAL/HIGH/...）
   - 空数据 / 单一 attackType 时显式渲染（不渲染空白图表）

## Candidate Hooks

- `use-security-log-events({ assetGroupId, filters, page, pageSize, sort })` — 事件列表
- `use-attack-trends({ assetGroupId, filters })` — 趋势聚合
- `use-log-source(sourceId)` — 单个 source 元信息（详情行展开时用，可选 lazy）
- `use-log-event-list-filters()` — URL search params zod 解析
- `use-log-trend-filters()` — URL search params zod 解析
- `use-current-actor-asset-groups()` — 决定默认 `assetGroupId` 与 URL guard

## Candidate MSW Handlers

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/log-events` | 事件流，参数与 `SecurityLogEventQuery` 对齐 + `sort` / `page` / `pageSize`；返回 `{ events: NormalizedSecurityLogEvent[], total, page, pageSize }` |
| GET | `/api/log-trends` | 趋势 bucket 列表，参数与 `AttackTrendQuery` 对齐；返回 `{ buckets: AttackTrendBucket[] }` + 计算好的 `groupedByAttackType`（mock 层做 rollup） |
| GET | `/api/log-sources/:sourceId` | source 元信息（事件行展开时调用，可选） |

## Assumptions

1. 路由 `/logs/events` 与 `/logs/trends` 是平行 tab，共享顶部 `assetGroupId` + `logType` + 时间窗口 selector；切换 tab 保留这三项
2. `assetGroupId` 缺失或越权时显式重定向到当前 actor 的第一个可见 group（带 toast 提示），不静默渲染空表
3. 事件流默认 pageSize=50；趋势页不分页（趋势聚合后总条数有限）
4. 事件行点击展开 inline，不进单独详情页（避免每条事件一个 N+1 详情请求）
5. `webFields` 仅在 `logType === 'WEB'` 时存在；其他日志类型不渲染 web 列
6. `targetAuthorized=false` 是攻击命中**未授权目标**的关键信号，必须用红色徽章而不是图标隐喻
7. 趋势页主要靠**文本摘要 + 水平柱图**，不引入时间序列折线（折线图归 dashboard 任务）
8. 事件不会跨 asset group 聚合显示——一次只看一个 group 的视图
9. 不实现导出（`log_event:export` 权限点对应的导出能力归 dashboard / report 任务）

## Open Questions

> 全部已锁定。无 Blocking。

- 后端 query 强制 `assetGroupId` → 单 group 视图设计已锁
- 趋势页无图表 vs 有图表 → 锁定"文本摘要为主 + 水平柱图为辅"，不引入时间序列
- 事件详情交互（行展开 vs 独立路由）→ 锁定行内 inline 展开
- 导出能力 → 锁定本任务不做

## Requirements

- **R1**：`web/src/shared/contracts/log-ingestion.contract.ts` 完整镜像后端 schema（含 `redactedFields: z.array(z.string())` 与 `targetAuthorized: z.boolean()` 字段）；不直接 import 后端 src/
- **R2**：`/logs/events` 与 `/logs/trends` URL key `assetGroupId` 为必填；缺失或越权重定向到默认 group + toast 提示
- **R3**：所有 filter / sort / page / since / until 进 URL；切换 tab 保留共享筛选项
- **R4**：事件行对每个 `redactedFields[]` 内的字段必须渲染 `<MaskedCell />`，**禁止**把 null 当空字符串
- **R5**：`targetAuthorized=false` 必须用红色文本徽章渲染"未授权目标"，不得仅靠图标
- **R6**：viewer 路由级阻止，进入 `/logs/events` 或 `/logs/trends` 立即 403 重定向；auditor / security-engineer 进入页面后字段完整可见
- **R7**：趋势页主区域必须有**文本摘要**（每个 attackType 一段）；图表仅做辅助，不可单独表达关键状态
- **R8**：事件流 `webFields` 仅在 `logType === 'WEB'` 时渲染（其他类型禁止显示 method / uriPath / statusCode 占位）
- **R9**：`classification === null` 行显式渲染 "无分类"；非 null 行的 `confidence` < 0.5 必须以低亮 / 灰度方式呈现
- **R10**：所有 MSW 响应经 zod parse；解析失败渲染 `unknown state` 视图
- **R11**：列表加载失败 / 解析失败 / 空结果 / 无权限 四种状态显式分支
- **R12**：代码内**禁止**任何"查看原文 / download payload"路径（与 mail 域 raw body 约束同型）

## Acceptance Criteria

- [ ] `cd web && npm run typecheck && npm run test && npm run build` 全过
- [ ] `/logs/events` 与 `/logs/trends` 都强制 `assetGroupId`；缺失时重定向到默认 group + toast
- [ ] 事件行 `redactedFields` 命中字段渲染 "masked" 单元格；mouse hover 显示原字段名（component test）
- [ ] `targetAuthorized=false` 行展示红色"未授权目标"徽章（component test）
- [ ] viewer 角色访问任一日志路由立即 403 重定向（路由级 guard，UI 不渲染任何 event 或 trend）
- [ ] auditor / security-engineer 角色进入页面后字段完整可见
- [ ] 趋势页文本摘要先于图表渲染；空数据时不展示空图表
- [ ] WEB 类型事件展开第二行显示 method / uriPath / statusCode；非 WEB 类型不展示 web 列
- [ ] integration test 覆盖：事件流 → 切换 logType filter → URL 反映 → 切到 `/logs/trends` 保留 assetGroupId + logType
- [ ] integration test 覆盖：mock 数据中含 5 个 attackType → 趋势页文本摘要 5 段 + 5 条柱图
- [ ] grep 自检：代码内不出现"raw payload" / "view original" / "下载日志原文" 路径

## Definition of Done

- 单测 + 集成测试覆盖 R1–R12 关键路径
- typecheck strict 通过；不引入 `any`
- frontend spec forbidden patterns 自检（无敏感字段当普通文本、无通用 status badge、无原文展示路径）
- 镜像契约与后端 zod schema 字段 / enum 完全对齐

## Out of Scope

- 日志导出（`log_event:export` 对应的脱敏事件 / 聚合指标导出）— 归 dashboard / report 任务
- 时间序列折线图 / 实时刷新（趋势靠后端聚合，UI 不做秒级 polling）— 归 dashboard 任务
- 单事件深度溯源 / 关联其他事件 — 父平台 PRD 明确"不自动攻击溯源、不生成攻击者画像"
- 自动封禁 / 阻断 / 触发扫描 — 父平台 PRD 明确"不基于日志自动执行封禁、阻断、扫描或漏洞利用"
- IOC 反查 / SIEM 风格关联分析 — 父平台 PRD 明确不属 MVP
- 日志源配置（增改 logSource、解析格式管理）— 归 `frontend-dashboard-audit-and-admin`
- 大屏汇总卡片（攻击趋势总览、严重度分布饼图）— 归 dashboard 任务
- 跨 asset group 全局视图（后端不支持，强约束）

## Decision (ADR-lite)

- **Context**：日志域是 4 个 surface 中**最受后端 query 强约束限制**的（assetGroupId 必填）；同时是唯一需要"事件 + 聚合"双视图的域，且必须遵守"文本摘要为主、不依赖纯图表"的 dashboard 哲学
- **Decision**：
  - 双 tab 路由 `/logs/events` 与 `/logs/trends`，共享顶部 `assetGroupId` / `logType` / 时间窗口 selector
  - 事件流行内 inline 展开，不做独立详情路由（避免 N+1 请求 + 详情页空设计）
  - 趋势页主区为文本摘要列表，按 `attackType` 分组；水平柱图为辅；不引入时间序列折线
  - `redactedFields[]` 通过专属 `<MaskedCell />` 组件渲染（建立第 4 域共享的 sensitive cell pattern）
  - `targetAuthorized=false` 用红色文本徽章——这是日志页最关键的安全信号
  - viewer 路由级阻止、MSW handler 在 mock 层做 query 过滤 + 趋势 rollup，与 vuln / mail 一致
- **Consequences**：
  - 真实后端如果按 `SecurityLogEventQuery` 与 `AttackTrendQuery` 提供端点，hook 接口稳定
  - `<MaskedCell />` 组件可被弱口令子任务复用（弱口令 masked 显示与 log redacted 共享语汇）
  - 趋势 rollup 在 mock 层做（按 attackType group），真实后端如果直接出已 group 数据，hook 不变

## Technical Notes

- 后端契约：
  - `src/modules/log-ingestion/contracts/log-ingestion.contract.ts`
  - `src/modules/log-ingestion/contracts/log-repository.contract.ts`
- 父任务 PRD：`.trellis/tasks/05-02-frontend-security-analysis-surfaces/prd.md`
- 平台 PRD：`.trellis/tasks/05-01-security-analysis-platform-prd/prd.md`（§7.7 日志分析、§8 数据契约、§3 角色权限）
- 兄弟任务（依赖 + 共享 pattern 来源）：
  - `.trellis/tasks/05-02-frontend-task-console-and-scope/prd.md`
  - `.trellis/tasks/05-04-frontend-vulnerability-surface/prd.md`
  - `.trellis/tasks/05-04-frontend-mail-analysis-surface/prd.md`
- frontend spec：`.trellis/spec/frontend/*.md`

---

## Final Confirmation

**Goal**：实现日志事件流 + 攻击趋势两屏，严格执行 `redactedFields[]` 显式标注、`targetAuthorized` 强信号、文本摘要为主的 dashboard 哲学，不实现导出与时间序列。

**Implementation Plan (small PRs)**:

- PR1：`web/src/shared/contracts/log-ingestion.contract.ts` 镜像 + 解析 + 单测；MSW handler 骨架（fixture + query 过滤 + 趋势 rollup）+ hook 占位 + 共享 `<MaskedCell />` 组件
- PR2：`/logs/events` 页（顶部 selector + URL state + 事件表 + Web 列扩展 + redactedFields 标注 + targetAuthorized 红徽章）+ 组件 + 集成测试
- PR3：`/logs/trends` 页（文本摘要按 attackType 分组 + 水平柱图 + 严重度分布徽章）+ 组件 + 集成测试
- PR4：viewer 路由级 guard + assetGroupId 必填重定向 + 错误/空/无权三态分支 + grep 自检

**Technical Approach**：复用 vuln / mail 子任务的列表 pattern 与 4 域共享视觉语汇；本任务新增 `<MaskedCell />` 共享组件供弱口令子任务复用；MSW handler 在 mock 层做趋势 rollup。
