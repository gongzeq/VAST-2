# backend: 补齐弱口令明文 view 契约与 endpoint

## Goal

补齐 `weak_password:cleartext_view` 权限点对应的查询契约：当前后端在 `foundation.ts` 已声明该权限点，且 `report-export.service.ts` 的 `exportWeakPasswordCleartext` 要求调用方传入 `WeakPasswordCleartextFinding[]`，但**没有**任何 endpoint 让客户端在 30 分钟窗口内取得这些 findings。本任务补齐这个契约缺口。

## Why

平台 PRD §7.5 明确：「安全工程师可在任务执行中查看爆破出的明文弱密码」+「明文弱密码只允许在任务执行期间或任务完成后 30 分钟内查看和导出」。当前现状：
- 权限点 `weak_password:cleartext_view` 已存在（`src/shared/contracts/foundation.ts`）
- 30 分钟窗口常量已存在（`WEAK_PASSWORD_CLEAR_WINDOW_MS`）
- 导出已实现（`exportWeakPasswordCleartext`），但需要 caller 传 findings → 当前没有渠道让前端拿到 findings

前端任务 `05-04-frontend-weak-password-surface` 在 brainstorm 阶段确认：仅实现 masked 列表 + XLSX 导出 dialog；明文 reveal 占位"等待 backend 实现"，待本任务交付后再开新前端任务接入。

## Scope (建议)

- 在 `src/modules/weak-password/contracts/` 新建 `weak-password.contract.ts`：
  - `weakPasswordCleartextSnapshotSchema = { taskId, taskCompletedAt, expiresAt, findings: WeakPasswordCleartextFinding[], windowStatus: 'OPEN' | 'EXPIRED' }`
  - `weakPasswordCleartextQuerySchema = { taskId, requestedAt? }`
  - 复用 `report` 模块已有的 `weakPasswordCleartextFindingSchema`
- 在 `src/modules/weak-password/domain/` 实现 view service：
  - 30min 窗口边界与 `report-export.service.ts` 完全一致（共享常量）
  - 仅当 actor 是任务发起者 + 拥有 `weak_password:cleartext_view` 权限 + 在窗口内时才返回明文
  - 过期 / 越权 抛出与导出一致的 `SensitiveExportExpiredError` / `AuthorizationDeniedError`
  - 任何"查看"动作进审计日志（不带明文密码）
- 持久化策略：明文不入库（与 PRD 一致），只在任务执行期 + 30min 内的内存中可达
- HTTP / 适配层契约（如 MSW / 真实路由就位时）：`GET /tasks/:taskId/weak-password-cleartext` 返回 `WeakPasswordCleartextSnapshot`

## Acceptance Criteria

- [ ] 新增 contracts + domain service + 单测（窗口内成功 / 过期失败 / 越权失败 / 审计日志写入但无明文）
- [ ] view 服务与 export 服务共享 `WEAK_PASSWORD_CLEAR_WINDOW_MS`
- [ ] 不引入新的明文持久化路径
- [ ] 前端 `05-04-frontend-weak-password-surface` 跟进任务可基于此契约接入明文 reveal

## Depends On / Blocks

- Depends on: 无（独立的 backend 补缺）
- Blocks: 真正实现"前端明文 reveal"的后续任务（本前端 surface 任务 MVP 不做 reveal，仅占位）

## Out of Scope

- 前端实现明文 reveal UI（属本前端 surface 任务后续阶段或新前端任务）
- 修改既有 `exportWeakPasswordCleartext` 行为
- 多副本 / 分布式窗口同步（MVP 单进程内存即可）

## Technical Notes

- 平台 PRD：`.trellis/tasks/05-01-security-analysis-platform-prd/prd.md` §7.5
- 现有相关代码：
  - `src/shared/contracts/foundation.ts`（权限点声明）
  - `src/modules/report/contracts/report.contract.ts`（cleartext finding schema）
  - `src/modules/report/domain/report-export.service.ts`（30min 窗口实现 + 审计模式）
- backend spec：`.trellis/spec/backend/{directory-structure,error-handling,quality-guidelines,logging-guidelines}.md`
