# 智能网络安全分析平台 MVP 实现

## Objective

根据已完成的 PRD 与 `.trellis/spec/backend/*`、`.trellis/spec/frontend/*`，将智能网络安全分析平台 MVP 拆分为可并行、可验收、可归档的实现任务。

## Parent / Children

- Parent: `05-01-security-analysis-platform-prd`
- Children:
  - `05-02-backend-foundation-and-policy`
  - `05-02-backend-workflow-execution`
  - `05-02-backend-mail-reports-and-exports`
  - `05-02-backend-log-ingestion-and-dashboard-api`
  - `05-02-frontend-task-console-and-scope`
  - `05-02-frontend-security-analysis-surfaces`
  - `05-02-frontend-dashboard-audit-and-admin`
  - `05-02-integration-and-quality-verification`

## Execution Order

### Wave 1

- backend foundation and policy

### Wave 2

- backend workflow execution
- backend mail, reports, and exports
- backend log ingestion and dashboard API
- frontend task console and scope

### Wave 3

- frontend security analysis surfaces
- frontend dashboard, audit, and admin

### Wave 4

- integration and quality verification

## Global Constraints

- 所有实现必须遵守现有 backend/frontend spec。
- 日志原文不保留；仅保留接收元数据、脱敏结构化事件和聚合指标。
- 授权根域允许同根域任意层子域发现，但不得跨根域扩展。
- 单封邮件超过 `50 MB` 时必须继续转发，仅分析正文并标记附件分析已跳过。
- 前端默认技术栈为 React + TypeScript。

## Acceptance Criteria

- 所有子任务均有明确 `prd.md` 和可实现边界。
- 子任务覆盖 PRD 的核心 MVP 范围。
- 子任务划分符合 backend/frontend spec 的模块与状态边界。
- 至少能支持按 Wave 顺序进入 Trellis 实施流程。
