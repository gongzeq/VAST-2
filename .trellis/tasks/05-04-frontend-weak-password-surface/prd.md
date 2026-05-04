# frontend: 弱口令结果与明文窗口

## Goal

实现弱口令分析师界面的 **B 范围 MVP**（受 backend 契约缺口约束）：
1. **Masked 列表页**：当前 actor 可见的 asset group 内已完成的弱口令任务及其 masked findings 摘要
2. **Masked 详情页（按 taskId）**：单任务的完整 masked findings 表
3. **XLSX 加密导出 dialog**：在 30 分钟窗口内触发 `exportWeakPasswordCleartextCommand`，展示一次性密码（dialog scope only，不入任何持久化）
4. **明文 reveal 占位 UI**：明文查看按钮永远渲染但 disabled，附"等待 backend `weak_password:cleartext_view` 端点交付"说明

本任务作为 4 域中**最高敏感**的子任务，承担"sensitive temporary state 实战验证"的角色：明文短期窗口、一次性密码 dialog、auditor 拒绝、路由 / dialog / tab 切换的清空规则——这些约束都要在本任务把 4 域共享 pattern 推到极致。

## What I already know

### 后端契约现状（关键差异）

| 能力 | 现状 |
|---|---|
| Masked finding 数据结构 | ✅ `weakPasswordMaskedFindingSchema`（targetRef / service / account / passwordMasked / severity） |
| Masked findings 列表渠道 | ⚠️ 通过 `ReportRecord.weakPasswordFindings` 访问；查 report 模块 `reportType=WEAK_PASSWORD` |
| Cleartext finding 数据结构 | ✅ `weakPasswordCleartextFindingSchema`（含 passwordPlaintext + discoveredAt） |
| Cleartext list / view endpoint | ❌ **不存在**——本任务 MVP 不实现 reveal，仅占位 |
| 导出 cleartext | ✅ `exportWeakPasswordCleartextCommand` + `reportExportResultSchema` 含 `oneTimePassword` |
| 30 分钟窗口 | ✅ `WEAK_PASSWORD_CLEAR_WINDOW_MS = 30 * 60 * 1000`（后端从 `taskCompletedAt` 起算） |
| 一次性密码持久化 | ✅ `passwordStored: z.literal(false)`（编译期保证不入库） |
| 过期错误码 | ✅ `SensitiveExportExpiredError` / `domainErrorCode='SENSITIVE_EXPORT_EXPIRED'` |
| 权限点 | ✅ `weak_password:cleartext_view` + `weak_password:cleartext_export` + `report:export` |

> **契约缺口处置**：明文 reveal 端点缺失 → 已新建 backend 跟进任务 `05-04-backend-weak-password-cleartext-view` 补齐；本前端任务 MVP 仅渲染 disabled 占位按钮，待 backend 完工后由独立任务接入 reveal。

### 平台 PRD §7.5 关键约束（必须落地）

- 明文只在「任务执行期 + 任务完成后 30 分钟内」可见
- 明文不入库；过期后彻底不可恢复，仅留脱敏
- 一次性密码只展示一次；不入 DB / 文件 / 审计日志
- 查看 / 复制 / 导出明文必须审计；审计日志不能含明文密码
- LLM 不接触明文
- 报告中弱密码必须脱敏

### 角色权限边界（已锁定）

- `security-engineer`（任务发起者）：
  - 可见 masked 列表 + 详情
  - 在 30min 窗口内可触发 XLSX 加密导出（拥有 `weak_password:cleartext_export`）
  - 可见明文 reveal 占位（按钮 disabled，附 backend 待交付说明）
- `auditor`：
  - 可见 masked 列表 + 详情（审计员审计需要）
  - **不可**触发 XLSX 加密导出（无 `weak_password:cleartext_export`）；导出按钮渲染为 `<UnauthorizedState>`，明示"无导出权限"，不隐藏
  - 不可见明文 reveal（与 export 同处置）
- `viewer`（管理层）：
  - **路由级阻止**。`/weak-passwords` 与 `/weak-passwords/:taskId` 对 viewer 直接 403 重定向（platform PRD §3"不得查看明文弱密码或工具原始输出"）
- 资产组 scope：列表必须按当前 actor 可见 asset group 过滤

### 兄弟任务依赖

- 必须等 `05-02-frontend-task-console-and-scope` 完成壳层之后才能落地
- 复用 vuln / mail / log 子任务的 `<StatusBadge>` / `<UnauthorizedState>` / `<EmptyState>` / `<ErrorState>` / `<MaskedCell />`
- 依赖 log 子任务建立的 `<MaskedCell />` 组件（弱口令 password masked 显示与 log redacted 共享语汇）
- brainstorm + jsonl 阶段可并行进行

## Pages

1. **`/weak-passwords`** — masked 列表（**按 task / report 维度聚合**）
   - 数据来源：当前 actor 可见 asset group 内 `reportType === 'WEAK_PASSWORD'` 的 `ReportRecord` 列表，每条 record 一行（一行 = 一个弱口令扫描任务的结果）
   - filter（URL state）：`assetGroupId`、`taskId`（可选，从 `/tasks/:taskId` 页面带入）、`since` / `until`
   - 默认排序：`createdAt` 倒序
   - pagination：URL `page` / `pageSize`（默认 25）
   - 每行：
     - `title`（report 标题）
     - 来源 `taskId`（链回 `/tasks/:taskId`）+ `assetGroupId`
     - **finding 数量**（`weakPasswordFindings.length`）
     - 严重度分布徽章（CRITICAL / HIGH / MEDIUM / LOW count，`weakPasswordMaskedFindingSchema.severity` 默认 HIGH）
     - `createdAt` 相对时间
     - **窗口状态徽章**：基于 `report.taskId` + 估算 `taskCompletedAt`（从 `/tasks/:taskId` 取 `lifecycleStage` 终态时间）+ now()：
       - `taskCompletedAt + 30min > now` → "明文窗口开放（剩余 X 分钟）" 绿/黄徽章
       - `taskCompletedAt + 30min <= now` → "已过期" 灰色徽章
       - 任务尚未完成 → "执行中（窗口待开启）" 蓝徽章
2. **`/weak-passwords/:taskId`** — 单 task masked 详情 + 导出入口
   - **顶部状态条**（关键：把窗口语义立刻表达）：
     - 窗口未开启（任务执行中）→ 蓝色横幅："任务执行中，明文窗口待开启"
     - 窗口开放 → 绿色 / 黄色横幅："明文窗口开放，剩余 X 分钟"（**实时 countdown，每秒更新**；< 5min 转黄）
     - 窗口已过期 → 灰色横幅："明文窗口已过期。后续仅可见 masked findings"
   - **Masked finding 表格**：渲染当前 task 的 `weakPasswordFindings[]`（来自 `ReportRecord`）
     - 列：`targetRef`、`service`、`account`、`passwordMasked`（用 `<MaskedCell />` 渲染，明确"已脱敏"语义）、`severity`
     - 排序：severity 降序 → service → account
   - **动作区**（按 actor 权限分支）：
     - `weak_password:cleartext_view` 占位按钮："查看明文（等待 backend 交付）"——**永远 disabled**，tooltip 注明等待 `backend-weak-password-cleartext-view` 任务完工
     - `weak_password:cleartext_export` 按钮："加密导出明文 (XLSX)"——窗口开放时启用；过期 / 无权限 → disabled + tooltip / `<UnauthorizedState>` 显式说明
   - **导出流程 dialog**（核心 sensitive UX）：
     - 第一步：确认 dialog（描述动作 + 目标范围 + 风险等级文本：「将下载本任务的明文弱密码 XLSX，文件加密，密码仅展示一次」）
     - 第二步：调用 `POST /api/weak-password-cleartext-exports`（MSW 实现）
       - **MVP 限制**：本任务 mock fixture **预先持有 cleartext findings**（用于演示导出流程）；真实场景下 cleartext 由 backend view 端点提供（待 follow-up 任务交付后接入）
     - 第三步：成功后 dialog 切到"密码展示"态：
       - 大字号显示 `oneTimePassword`
       - "复制"按钮 + "我已记录密码"checkbox（必勾才能关闭 dialog）
       - dialog 关闭后密码立即从 React state 清除
       - 30 秒倒计时自动关闭 dialog（防离开座位密码裸露）
     - 失败处理：
       - `SENSITIVE_EXPORT_EXPIRED` → dialog 切到红色"窗口已过期"态，提示无法恢复
       - 网络错误 / 解析失败 → 标准 `<ErrorState>`
   - **审计提示**：动作区下方一行小字「查看 / 导出 / 复制 都将记入审计日志」

## Candidate Hooks

- `use-weak-password-reports({ filters, page, pageSize })` — 列表查询（基于 `ReportQuery` + `reportType=WEAK_PASSWORD`）
- `use-weak-password-report(taskId)` — 单任务 masked findings 详情
- `use-task-completion(taskId)` — 取 task 终态时间 + lifecycleStage（来自 `task-execution` 模块），用于窗口 countdown
- `use-cleartext-window(taskId)` — 派生 hook：`{ status: 'pending'|'open'|'expired', remainingMs, expiresAt }`，秒级刷新；hook 内部仅持有窗口元数据，**不持有 cleartext findings**
- `use-can-export-cleartext()` — `weak_password:cleartext_export` 权限点判定
- `use-export-weak-password-cleartext()` — mutation hook，调用 export endpoint，返回 `{ oneTimePassword, exportRecord }`；返回值仅在 mutation 生命周期内可达，hook 卸载即清空

## Candidate MSW Handlers

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/reports?reportType=WEAK_PASSWORD&...` | 列表，复用 report 模块 query |
| GET | `/api/reports/:reportId` 或 `/api/weak-password-reports/by-task/:taskId` | 单任务 masked findings |
| POST | `/api/weak-password-cleartext-exports` | 触发导出，返回 `{ oneTimePassword, exportRecord }`；过期返回 `SENSITIVE_EXPORT_EXPIRED` |

> **MSW 实现策略**：mock fixture 内预置一份 cleartext findings 用于演示导出流程；handler 收到 export 请求时，根据 `taskCompletedAt + 30min` 判定窗口（与 backend 一致），过期返回 `ApiErrorResponse` `{ errorCode: 'SENSITIVE_EXPORT_EXPIRED' }`。一次性密码用 `crypto.randomUUID()`（仅 mock，不模拟 base64url）。

## Sensitive Display 硬约束（本任务必须实现）

| 状态 | 约束 |
|---|---|
| `oneTimePassword` 持有位置 | 仅在 `useExportWeakPasswordCleartext` mutation 返回值与 dialog 组件 `useState`；**禁止**进 `localStorage` / `sessionStorage` / URL / `ActorContext` / Query cache |
| dialog 关闭 | 立即清空 `useState`；ref 设 null；mutation result 调 `mutate.reset()` |
| 路由切换 | dialog 卸载触发 cleanup → 同上 |
| 标签页切到后台 | `document.visibilitychange` 监听；切到后台时 dialog 自动 blur 密码（用 `<MaskedCell />` 复用）；切回前景需要再次明确点击 reveal |
| 30 秒空闲倒计时 | 倒计时归零 → dialog 自动关闭，密码清空 |
| 复制到剪贴板 | 调 `navigator.clipboard.writeText()`；不写入任何 DOM 持久节点；提示"复制后请尽快粘贴使用，剪贴板可能被其他程序读取" |
| 任何 React state | 不允许把 `oneTimePassword` 通过 props drilling 出 dialog 边界；强制由 dialog 自己持有 |
| Component test | grep 自检：`oneTimePassword` 字符串只出现在 dialog 组件文件 + mutation hook 文件，不在其他文件 |

## Assumptions

1. 列表页将 report record 等同于"一个弱口令任务的执行结果"——基于 `report.taskId` 一对一映射
2. 窗口 countdown 在前端按 1s tick 计算；过期判定也由后端二次确认（`SENSITIVE_EXPORT_EXPIRED`）；前端不依赖客户端时钟单方判定
3. 多 tab 同开导出 dialog 不做跨 tab 同步：每个 tab 各自管理自己的 `oneTimePassword`；后端审计日志会显示多次导出请求
4. 导出 dialog 的"30 秒空闲自动关闭"是前端独立逻辑，不依赖后端 expiresAt
5. 真实 XLSX 文件下载在 MVP 走 MSW mock：handler 返回 `Blob` + `Content-Disposition: attachment`；前端用 `URL.createObjectURL` 触发下载；下载后立即 `revokeObjectURL`
6. 明文 reveal 占位按钮永远 disabled，UI 文案明确"等待 backend 实现"，避免 auditor 误以为是无权限

## Open Questions

> 全部已锁定。无 Blocking。

- 窗口语义：锁定"taskCompletedAt + 30min" + 客户端 countdown + 后端二次校验
- 一次性密码呈现：锁定 dialog scope only + 30s 空闲自动关闭 + 强制勾选"我已记录"
- 明文 reveal：锁定占位 disabled，等 backend follow-up 任务交付
- 标签页可见性：锁定切到后台 blur

## Requirements

- **R1**：`web/src/shared/contracts/weak-password.contract.ts` 镜像 `weakPasswordMaskedFindingSchema` / `weakPasswordCleartextFindingSchema` / `exportWeakPasswordCleartextCommandSchema` / `reportExportResultSchema` 等关联 schema；不直接 import 后端 src/
- **R2**：列表所有 filter / sort / page / since / until 进 URL；刷新 / 分享链接保留状态
- **R3**：详情页**顶部状态条**根据窗口三态（pending / open / expired）显式渲染
- **R4**：窗口 countdown 实时刷新（1s tick）；剩余 < 5min 转黄；< 0s 切换为"已过期"
- **R5**：viewer 路由级阻止（403）；auditor 进入页面后导出按钮以 `<UnauthorizedState>` 显式呈现"无导出权限"，不得隐藏
- **R6**：明文 reveal 占位按钮永远 disabled，且 UI 显式说明"等待 backend `weak_password:cleartext_view` 端点交付"
- **R7**：`oneTimePassword` 持有路径严格限定（dialog `useState` + mutation 返回值），grep 自检不允许出现在其他文件；不进 localStorage / sessionStorage / URL / ActorContext / Query cache
- **R8**：导出 dialog 实现"复制 + 必勾 + 30s 自动关闭 + visibilitychange 切后台 blur"四件套
- **R9**：导出失败返回 `SENSITIVE_EXPORT_EXPIRED` → dialog 红色过期态；其他错误走标准 `<ErrorState>`
- **R10**：`<MaskedCell />` 组件复用 log 子任务实现，统一表达 "已脱敏" 语义；不允许把 `passwordMasked` 当普通字符串渲染
- **R11**：所有 MSW 响应经 zod parse；解析失败渲染 `unknown state` 视图
- **R12**：列表加载失败 / 解析失败 / 空结果 / 无权限 四种状态显式分支
- **R13**：审计相关 UI 文案明示"查看 / 导出 / 复制 都将记入审计日志"

## Acceptance Criteria

- [ ] `cd web && npm run typecheck && npm run test && npm run build` 全过
- [ ] 列表页可按 assetGroup / taskId / 时间窗筛选；URL 反映 filter；刷新后状态保留
- [ ] 详情页可从列表点击进入；顶部状态条根据窗口三态显式渲染（component test 三分支各一）
- [ ] 窗口 countdown 在 component test 中通过 fake timer 验证 1s tick 与 < 5min 转黄
- [ ] viewer 角色访问 `/weak-passwords` / `/weak-passwords/:taskId` 立即 403 重定向
- [ ] auditor 角色进入页面后看到 masked findings 表格，但导出按钮显式呈现"无 weak_password:cleartext_export 权限"
- [ ] security-engineer 角色（任务发起者）窗口开放时可触发导出 dialog；密码展示态有"我已记录"checkbox + 30s 倒计时
- [ ] grep 自检：`oneTimePassword` 字符串不出现在 localStorage / sessionStorage / URL / ActorContext / 共享 Query cache 路径
- [ ] integration test 覆盖：完整流程（列表 → 详情 → 窗口开放 → 导出 dialog → 密码展示 → 关闭 → 密码消失）
- [ ] integration test 覆盖：mock 后端返回 `SENSITIVE_EXPORT_EXPIRED` → dialog 切红色过期态
- [ ] integration test 覆盖：标签页 visibilitychange='hidden' → dialog 密码 blur
- [ ] 明文 reveal 占位按钮在所有窗口状态下都是 disabled；tooltip 包含"等待 backend"

## Definition of Done

- 单测 + 集成测试覆盖 R1–R13 关键路径
- typecheck strict 通过；不引入 `any`
- frontend spec forbidden patterns 自检（无敏感字段当普通文本、无 sensitive temp state 持久化、`oneTimePassword` 持有路径限定）
- 镜像契约与后端 zod schema 字段 / enum 完全对齐
- README 更新：弱口令 surface 的 dev mock 场景覆盖（窗口开放 / 过期 / auditor 视角 / 导出 dialog）

## Out of Scope

- **明文 reveal 真正实现**：等 `05-04-backend-weak-password-cleartext-view` 任务交付后由新前端任务接入
- 弱口令任务的发起 / 配置 / 字典管理（属 task-console 或 admin 任务）
- 历史导出记录浏览页（"看过去导出过哪些 task 的弱密码"）— 后续可独立任务，本 MVP 不做（避免泄露导出元数据维度的敏感信号）
- 跨 task 弱口令汇总视图（如同一 service / account 在不同 task 下出现的关联）— 归 dashboard 任务
- 真实 XLSX 加密 / OOXML 处理 — MVP 走 MSW mock blob
- 国际化 / 深色模式
- 在弱口令页直接修改 finding status — 后续独立任务

## Decision (ADR-lite)

- **Context**：弱口令是 4 域中**唯一存在 backend 契约缺口**的（明文 view 端点缺失）；同时是**最高敏感**的 sensitive temporary state 实战验证点；UI 必须把 30min 窗口 + 一次性密码 + auditor 拒绝 + visibilitychange 切后台 + 导出失败过期态 五件事同时表达清楚
- **Decision**：
  - MVP 仅实现 masked + 导出 dialog 路径；明文 reveal 占位 disabled，新建 backend follow-up 任务（`05-04-backend-weak-password-cleartext-view`）补契约
  - 列表数据走 `report` 模块（`reportType=WEAK_PASSWORD`），不依赖独立的弱口令 list 端点
  - 一次性密码严格限定在 dialog `useState` + mutation 返回值；grep 自检确保不外泄
  - 窗口 countdown 客户端 1s tick + 后端 `SENSITIVE_EXPORT_EXPIRED` 二次校验
  - `<MaskedCell />` 组件复用 log 子任务实现
  - viewer 路由级 403；auditor 显式 `<UnauthorizedState>`；security-engineer 完整流程
- **Consequences**：
  - backend follow-up 任务交付后，需要新前端任务（不在本任务范围）实现 reveal；本任务的占位按钮已显式标注，迁移成本低
  - 真实 XLSX 加密走 MSW mock blob，迁移到真实后端时 mutation hook 接口不变（仅 fetch 实现替换）
  - 一次性密码相关代码必须有 grep 自检；评审清单专列一项

## Technical Notes

- 后端契约：
  - `src/modules/report/contracts/report.contract.ts`（masked / cleartext / export 命令 / 一次性密码）
  - `src/modules/report/domain/report-export.service.ts`（30min 窗口实现）
  - `src/shared/contracts/foundation.ts`（权限点 + `SENSITIVE_EXPORT_EXPIRED` 错误码）
- 父任务 PRD：`.trellis/tasks/05-02-frontend-security-analysis-surfaces/prd.md`
- 平台 PRD：`.trellis/tasks/05-01-security-analysis-platform-prd/prd.md`（§7.5 弱口令 + §3 角色权限）
- backend follow-up：`.trellis/tasks/05-04-backend-weak-password-cleartext-view/prd.md`
- 兄弟任务（依赖 + 共享 pattern 来源）：
  - `.trellis/tasks/05-02-frontend-task-console-and-scope/prd.md`
  - `.trellis/tasks/05-04-frontend-vulnerability-surface/prd.md`
  - `.trellis/tasks/05-04-frontend-mail-analysis-surface/prd.md`
  - `.trellis/tasks/05-04-frontend-log-analysis-surface/prd.md`（`<MaskedCell />` 来源）
- frontend spec：`.trellis/spec/frontend/*.md`（重点：state-management.md sensitive temporary state 规则）

---

## Final Confirmation

**Goal**：实现弱口令 masked 列表 + 详情 + XLSX 加密导出 dialog（含一次性密码、30min 窗口、visibilitychange 后台 blur、auditor 拒绝），明文 reveal 占位待 backend follow-up。

**Implementation Plan (small PRs)**:

- PR1：`web/src/shared/contracts/weak-password.contract.ts` 镜像 + 解析 + 单测；MSW handler 骨架（report 列表 + 导出 + 过期错误）+ hook 占位 + `<CleartextWindowBanner />` 三态组件
- PR2：列表页（filter / sort / page + 严重度分布徽章 + 窗口状态徽章）+ 组件 + 集成测试
- PR3：详情页（masked 表格 + `<CleartextWindowBanner />` 实时 countdown + 导出按钮门禁 + 明文 reveal 占位）+ 组件 + 集成测试
- PR4：导出 dialog 完整链路（确认 → 调用 → 密码展示 → 复制 / 必勾 / 30s 自动关闭 / visibilitychange blur / 失败过期态）+ grep 自检 + 集成测试

**Technical Approach**：复用 vuln / mail / log 子任务确立的列表 pattern + 4 域共享视觉语汇 + log 子任务的 `<MaskedCell />`；本任务新增 `<CleartextWindowBanner />`、`<OneTimePasswordDialog />` 两个高敏感组件；MSW handler 在 mock 层实现窗口边界 + 过期错误码。
