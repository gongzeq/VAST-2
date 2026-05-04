# frontend: 邮件分析列表与详情

## Goal

实现钓鱼邮件分析师界面：列表页（按 assetGroup / gateway / phishingLabel / 时间窗筛选）+ 详情页（摘要 + 安全 Header + IOC + 附件分析 + 转发结果 + UNAVAILABLE/BODY_ONLY_SIZE_LIMIT 显式分支）。沿用 `frontend-vulnerability-surface` 子任务确立的共享 pattern：跨 record 聚合、URL state、viewer 路由级阻止、MSW handler 在 mock 层做查询过滤。

本子任务的独特挑战是**正确分支化邮件分析的"不可见原因"**：fail-open（UNAVAILABLE）与 50MB 截断（BODY_ONLY_SIZE_LIMIT）不能渲染成"看上去清洁的邮件"。同时严格执行 raw body 不展示约束（`rawBodyStored: false`）。

## What I already know

### 后端契约

来源：`src/modules/phishing-mail/contracts/mail-analysis.contract.ts` + `mail-repository.contract.ts`

核心 schema：

- `phishingLabelSchema` — `suspected` / `suspicious` / `clean`
- `mailAnalysisModeSchema` — `FULL` / `BODY_ONLY_SIZE_LIMIT` / `UNAVAILABLE`
- `mailAnalysisStatusSchema` — `ANALYZED` / `UNAVAILABLE`
- `mailForwardingStatusSchema` — `FORWARDED`（**只有一个状态**——fail-open 设计：分析失败邮件仍转发，不阻断）
- `mailIocKindSchema` — `URL` / `DOMAIN` / `IP` / `EMAIL`
- `mailAnalysisRecordSchema`（详情核心字段）：
  - 标识：`mailTaskId`（一封邮件的 ID）、`gatewayId`、`assetGroupId`、`sourceRef`
  - 元信息：`receivedAt`、`subject`（nullable）、`from`（nullable）、`recipients[]`、`messageSizeBytes`、`bodySha256`
  - 强约束：`rawBodyStored: false`（z.literal(false) — 编译期保证 raw body 不入库）
  - 分析模式与状态：`analysisMode` × `analysisStatus`
  - 风险评分：`phishingLabel`（nullable）、`riskScore`（0-100, nullable）、`riskSignals[]`、`unavailableReason`（nullable）
  - 安全 Header：`securityHeaders: Record<string,string>`（如 `X-Security-Phishing` / `X-Security-Risk-Score` / `X-Security-Task-ID` / `X-Security-Analysis`）
  - 附件分析：`attachmentAnalyses[]`（每条 `{ filename, sizeBytes, contentType, sha256, analyzed, skippedReason, fileType, riskSignals[] }`）
  - IOC：`iocs[]`（每条 `{ kind, value }`）
  - 转发结果：`forwardingResult: { status, downstreamHost, downstreamPort, forwardedAt, appliedHeaders }`
- `mailGatewayConfigSchema`（详情可链跳）：`gatewayId`、`assetGroupId`、`inboundSourceRefs[]`、`downstreamHost`、`downstreamPort`、`enabled`

### 后端 Query 维度（决定 MSW handler shape）

`MailAnalysisQuery`：`assetGroupId?` / `gatewayId?` / `phishingLabel?` / `since?` / `until?` / `limit?`

→ 列表页 URL state 直接映射这些 key。

### 父级 Tracker 共享约束

详见 `.trellis/tasks/05-02-frontend-security-analysis-surfaces/prd.md`：
- 契约镜像到 `web/src/shared/contracts/mail-analysis.contract.ts`，不直接 import 后端 src/
- 所有 MSW 响应必经 zod parse；解析失败 → unknown state 视图
- 列表 filter / sort / pagination 走 URL state；时间窗口同
- 共享视觉语汇 + `<UnauthorizedState>` / `<EmptyState>` / `<ErrorState>` 严格区分
- 角色权限边界：viewer 不可见、auditor 与 security-engineer 可见

### 角色权限边界（已锁定）

- `security-engineer`：可查看授权资产组内的邮件分析记录
- `auditor`：只读，可查看完整记录（platform PRD §3"安全审计员可查看任务、审计日志、工具参数、原始证据引用和报告"——邮件分析记录属于"原始证据引用"范畴）
- `viewer`（管理层）：**路由级阻止**。`/mails` / `/mails/:mailTaskId` 对 viewer 直接 403 重定向（platform PRD §3"管理层不得查看敏感原始输出、邮件样本、明文弱密码或工具原始输出"——邮件 metadata + 安全 Header + IOC 即"邮件样本"语义）
- 资产组 scope：列表必须按当前 actor 可见 asset group 过滤
- 共享权限点：`raw_evidence:view`（auditor / security-engineer 默认拥有，viewer 不拥有 → 等同路由级阻止）

### 兄弟任务依赖

- 必须等 `05-02-frontend-task-console-and-scope` 完成 `App / router / Providers / MSW worker / fetch helper / ActorProvider / shared/components` 之后才能落地
- 必须等 `05-04-frontend-vulnerability-surface` 完成或同步建立共享组件（`<StatusBadge>` / `<UnauthorizedState>` / `<EmptyState>` / `<ErrorState>`），才能复用其确立的列表 pattern；但 brainstorm + jsonl 阶段可以并行进行

## Pages

1. **`/mails`** — 邮件分析列表
   - 数据来源：当前 actor 可见 asset group 内的全部 `MailAnalysisRecord`，按 `receivedAt` 倒序；分页 `page` / `pageSize`（默认 25）
   - filter（URL state，与后端 query 一致）：`assetGroupId`、`gatewayId`、`phishingLabel`、`since`、`until`
   - 默认时间窗口：最近 7 天（`since` 默认 = `now - 7d`，`until` 不设）；用户可调；URL 显式承载时间窗口
   - sort：`receivedAt`（默认）/ `riskScore`（nulls 末尾）/ `messageSizeBytes`
   - 每行：
     - `phishingLabel` 徽章（`suspected` red / `suspicious` warning / `clean` neutral / `null` UNAVAILABLE 形 → "—"+小标 "分析不可用"）
     - `riskScore`（null → "—"）
     - `subject`（null → "(无主题)"）
     - `from`（null → "(发件人未识别)"）
     - `recipients[0..2]` + "+N more"（避免群发邮件长行）
     - `analysisMode` 角标：仅 FULL 时不显示；`BODY_ONLY_SIZE_LIMIT` 显示"附件未分析"角标；`UNAVAILABLE` 显示"分析不可用"角标
     - `forwardingResult.forwardedAt` 相对时间（相对 receivedAt 的差值，验证转发延迟）
2. **`/mails/:mailTaskId`** — 邮件分析详情
   - **顶部状态条**（关键：必须把"不可见原因"立刻表达）：
     - `analysisStatus === 'UNAVAILABLE'` → 红/灰横幅："本封邮件分析不可用，网关 fail-open 已转发" + 显式 `unavailableReason`
     - `analysisMode === 'BODY_ONLY_SIZE_LIMIT'` → 黄/警告横幅："邮件 N MB（超 50MB 上限），仅分析正文，附件未分析"
     - `analysisStatus === 'ANALYZED' && analysisMode === 'FULL'` → 无横幅；正常展示
   - **摘要块**：subject / from / recipients（默认折叠超过 5 个）/ receivedAt / messageSizeBytes / bodySha256
   - **风险评分块**（仅 ANALYZED）：phishingLabel 大徽章 + riskScore 0-100 进度条 + `riskSignals[]` 列表
   - **安全 Header 块**：以 key-value 表形式渲染 `securityHeaders`，特别突出 `X-Security-Phishing` / `X-Security-Risk-Score` / `X-Security-Task-ID` / `X-Security-Analysis` 四个 PRD 强制 Header
   - **IOC 块**（仅 ANALYZED）：按 `kind` 分组（URL / DOMAIN / IP / EMAIL）渲染；空数组显式渲染"未提取到 IOC"
   - **附件分析表格**：每条 `attachmentAnalyses[]` 一行，列：filename / sizeBytes / contentType / fileType / `analyzed`（✓/✗）/ `skippedReason`（✗ 时显式）/ `riskSignals[]`
     - `BODY_ONLY_SIZE_LIMIT` 模式下每条 `analyzed=false` + `skippedReason="邮件超 50MB 上限"`
     - `UNAVAILABLE` 模式下表格整体替换为"分析不可用，附件信息仅元数据"
   - **转发结果块**：`forwardingResult.{ status, downstreamHost, downstreamPort, forwardedAt }` + 应用的 `appliedHeaders`（与上方"安全 Header 块"做去重展示）
   - **链回**：`gatewayId` 链到 `/admin/mail-gateways/:gatewayId`（属于 admin 任务，本任务只放占位链接）；`assetGroupId` 链到 `/asset-scope`

## Candidate Hooks

- `use-mail-analyses({ filters, page, pageSize, sort })` — 列表查询，filter 与后端 `MailAnalysisQuery` 对齐
- `use-mail-analysis(mailTaskId)` — 详情查询
- `use-mail-list-filters()` — URL search params zod 解析（封装 filter/sort/page/since/until）
- `use-mail-gateway(gatewayId)` — 详情页底部 gateway 元信息（可选，若 admin 任务未就绪可缓后引入）

## Candidate MSW Handlers

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/mails` | 列表，支持 `assetGroupId` / `gatewayId` / `phishingLabel` / `since` / `until` / `sort` / `page` / `pageSize`；返回 `{ records: MailAnalysisRecord[], total, page, pageSize }` |
| GET | `/api/mails/:mailTaskId` | 详情 |
| GET | `/api/mail-gateways/:gatewayId` | gateway 元信息（详情页底部链接，可选） |

## Assumptions

1. 列表是**跨 task / 跨 gateway 聚合**（同一 asset group 内所有 gateway 的邮件按 receivedAt 时间序合并）；用户用 `gatewayId` filter 收窄
2. 邮件每行不展开 attachments / IOCs，避免列表行过高；只在详情页展开
3. `recipients[]` 在列表展示前 3 个 + "+N more"；详情页默认折叠超过 5 个，点开看全
4. raw body **从不**在 UI 任何地方展示——`bodySha256` 仅作为元数据可见，不附"download body"动作
5. `riskSignals[]` 字符串是后端预定义短语（如 `"spf:fail"` / `"unusual-header"`），前端不做自然语言渲染；如需对照表可在后续任务建立
6. 列表加载默认窗口为 "最近 7 天"，可由用户调整；URL 显式承载 `since` / `until`
7. PARTIAL_SUCCESS / FAILED 概念在邮件域不存在（`forwardingResult.status` 只有 `FORWARDED`）；网关失败的邮件压根不会进入分析记录
8. 邮件不属于 `task-list` 中的 `TaskRecord`；mail "task" 是邮件 ID 别名，不要在 `/tasks` 页面混合呈现

## Open Questions

> 全部已锁定。无 Blocking。

- 沿用 vuln 任务的 viewer 路由级阻止 / auditor 与 security-engineer 可见 / MSW handler 做 mock query 过滤 三项约定，无需重新决议
- 列表/详情页面切分、IOC 与附件分组方式、不可见原因横幅设计 均已在 Pages 章节锁定
- 详情页的 gateway 链接占位是否影响实施？→ 否，placeholder anchor 即可，admin 任务接手后填实

## Requirements

- **R1**：`web/src/shared/contracts/mail-analysis.contract.ts` 完整镜像后端 schema（含 `rawBodyStored: z.literal(false)` 编译期约束）；不直接 import 后端 src/
- **R2**：列表所有 filter / sort / page / since / until 进 URL；刷新 / 分享链接保留状态
- **R3**：详情页对 `analysisStatus === 'UNAVAILABLE'` 与 `analysisMode === 'BODY_ONLY_SIZE_LIMIT'` 必须有顶部状态横幅，不得"沉默"渲染
- **R4**：`riskScore` null / `phishingLabel` null / `subject` null / `from` null 显式渲染（`—` / "(无主题)" / "(发件人未识别)"）
- **R5**：viewer 路由级阻止，进入 `/mails` 或 `/mails/:mailTaskId` 立即 403 重定向；auditor / security-engineer 进入页面后所有字段可见
- **R6**：raw body 在前端代码中**禁止**出现任何展示路径；`bodySha256` 仅作为元数据，不挂"下载正文"动作
- **R7**：`attachmentAnalyses[]` 中 `analyzed=false` 行必须显式渲染 `skippedReason`，不得简化为图标
- **R8**：`securityHeaders` 表格优先展示 PRD §7.1 强制四 Header（`X-Security-Phishing` / `X-Security-Risk-Score` / `X-Security-Task-ID` / `X-Security-Analysis`），其余按字母序
- **R9**：所有 MSW 响应经 zod parse；解析失败渲染 `unknown state` 视图
- **R10**：列表加载失败 / 解析失败 / 空结果 / 无权限 四种状态显式分支（`<ErrorState>` / `<EmptyState>` / `<UnauthorizedState>` / unknown-state）

## Acceptance Criteria

- [ ] `cd web && npm run typecheck && npm run test && npm run build` 全过
- [ ] 列表页可按 phishingLabel / gateway / assetGroup / 时间窗筛选；URL 反映当前 filter；刷新后状态保留
- [ ] 详情页可从列表点击进入；浏览器返回不丢列表 filter
- [ ] viewer 角色访问 `/mails` / `/mails/:mailTaskId` 立即 403 重定向（路由级 guard，UI 不渲染任何 mail 内容）
- [ ] auditor / security-engineer 角色进入页面后可见所有字段
- [ ] `analysisStatus === 'UNAVAILABLE'` 详情页有红/灰顶部横幅 + `unavailableReason` 文本（component test）
- [ ] `analysisMode === 'BODY_ONLY_SIZE_LIMIT'` 详情页有黄/警告横幅 + 附件全部 `analyzed=false`（component test）
- [ ] 列表行 `phishingLabel` null 时显示 "—" 与"分析不可用"角标，**不**显示 "clean" 徽章
- [ ] 列表 `recipients[]` 长度 > 3 时展示 "+N more"，详情页可展开看全
- [ ] integration test 覆盖：列表 → 筛选 phishingLabel=suspected → 进入详情 → 返回列表保留 filter
- [ ] integration test 覆盖：UNAVAILABLE 邮件详情页不展示 phishing label 大徽章 / IOC 块 / 附件分析
- [ ] grep 自检：代码内不出现展示 raw body 的路径

## Definition of Done

- 单测 + 集成测试覆盖 R1–R10 关键路径
- typecheck strict 通过；不引入 `any`
- frontend spec forbidden patterns 自检（无敏感字段当普通文本、无通用 status badge、无 raw body 展示）
- 镜像契约与后端 zod schema 字段 / enum 完全对齐（特别是 `rawBodyStored: z.literal(false)`）

## Out of Scope

- 邮件回放 / 发送 / 重新分析（platform PRD 明确 fail-open，无回放路径）
- 主动隔离 / 阻断（platform PRD 明确：默认不删除、不隔离、不阻断）
- IOC 反查（"用此 IOC 找到所有命中邮件"）— 留给后续 dashboard / 关联分析任务
- sender 信誉聚合视图、发件域分布 — 归 dashboard 任务
- 邮件统计概览卡片（phishingLabel 分布、最近 24h count）— 归 dashboard 任务
- mail gateway 配置管理 — 归 `frontend-dashboard-audit-and-admin`
- 真实 SMTP / 真实邮件网关接入 — 一律 MSW
- LLM 风险摘要解释面板（`riskSignals` 自然语言渲染）— 后续独立任务

## Decision (ADR-lite)

- **Context**：邮件域是 4 个 surface 中**信号路径最复杂**的——`analysisMode` × `analysisStatus` × `phishingLabel` 三维组合，再加 50MB 截断与 fail-open 两条特殊分支；同时受 `rawBodyStored: false` 强约束限制可展示字段
- **Decision**：
  - 列表行用 `phishingLabel` 作为主指示，`analysisMode !== 'FULL'` 用角标补充"附件未分析"或"分析不可用"，避免主徽章污染（不可分析的邮件不能显示"clean"）
  - 详情页 **顶部状态条** 是 UNAVAILABLE / BODY_ONLY_SIZE_LIMIT 的强制呈现位，不得藏在小角标
  - `recipients[]` 在列表只展示前 3 个 + "+N more"；详情页默认折叠超过 5 个；不做后端 mass-distribution 检测（属 dashboard 任务）
  - viewer 路由级阻止，与 vuln 子任务一致
  - MSW handler 在 mock 层完整支持 `MailAnalysisQuery` 五个维度的过滤 + 分页 + 排序
- **Consequences**：
  - 真实后端如果按 `MailAnalysisQuery` 提供 list 端点，hook 接口稳定无需重构
  - `riskSignals[]` 自然语言化必然要在某个后续任务建立映射表，本任务只渲染原 token

## Technical Notes

- 后端契约：`src/modules/phishing-mail/contracts/mail-analysis.contract.ts` + `mail-repository.contract.ts`
- 父任务 PRD：`.trellis/tasks/05-02-frontend-security-analysis-surfaces/prd.md`
- 平台 PRD：`.trellis/tasks/05-01-security-analysis-platform-prd/prd.md`（§7.1 Phishing Email Analysis、§3 角色权限）
- 兄弟任务（依赖 + 共享 pattern 来源）：
  - `.trellis/tasks/05-02-frontend-task-console-and-scope/prd.md`
  - `.trellis/tasks/05-04-frontend-vulnerability-surface/prd.md`（vuln 子任务确立的 4 域共享 list pattern）
- frontend spec：`.trellis/spec/frontend/*.md`

---

## Final Confirmation

**Goal**：实现钓鱼邮件分析师界面（列表 + 详情），正确分支化 UNAVAILABLE / BODY_ONLY_SIZE_LIMIT 不可见原因，严格执行 raw body 不展示约束。

**Implementation Plan (small PRs)**:

- PR1：`web/src/shared/contracts/mail-analysis.contract.ts` 镜像 + 解析 + 单测；MSW handler 骨架（fixture + query 过滤）+ hook 占位
- PR2：列表页（filter/sort/page/since/until + 角标 + recipients 折叠）+ 组件 + 集成测试
- PR3：详情页（顶部状态条三分支 + 摘要 + 风险评分 + 安全 Header + IOC 分组 + 附件表格 + 转发结果）+ 组件 + 集成测试
- PR4：viewer 路由级 guard + 错误/空/无权三态分支 + UNAVAILABLE / BODY_ONLY_SIZE_LIMIT 集成测试

**Technical Approach**：复用 vuln 子任务确立的列表 pattern + 4 域共享视觉语汇，邮件域唯一新增的是顶部状态条三分支与 raw body 强约束自检。
