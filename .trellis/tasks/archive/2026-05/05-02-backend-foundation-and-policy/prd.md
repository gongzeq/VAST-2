# backend: 平台基础、授权与审计边界

## Objective

实现后端底座能力：认证与权限边界、资产范围管理、任务状态模型、规划/执行编排骨架、统一错误模型、审计事件写入。

## Depends On

- `.trellis/spec/backend/directory-structure.md`
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/quality-guidelines.md`

## Scope

- 搭建后端模块目录与共享边界
- 定义任务状态、资产状态、强度级别等核心枚举
- 实现授权检查点与资产范围判定
- 实现任务创建、澄清、确认、取消、状态流转骨架
- 实现 append-only 审计记录
- 实现统一错误码与 API 错误响应基础设施

## Out of Scope

- 具体扫描器适配
- 邮件分析细节
- 日志接入与聚合细节
- 前端界面

## Acceptance Criteria

- 任务/资产/审计相关持久化模型与状态机可用
- `BLOCKED`、`NEEDS_CLARIFICATION`、`PARTIAL_SUCCESS` 等状态有明确后端语义
- 高风险操作存在确认前置校验
- 授权根域仅扩展到同根域任意层子域
- 所有敏感动作可产出审计记录
