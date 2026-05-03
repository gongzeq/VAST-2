# backend: 工具执行与安全工作流

## Objective

在基础权限与任务编排之上，实现受控命令/工具执行能力，以及资产发现、端口/服务识别、漏洞扫描、弱口令扫描等固定安全工作流。

## Depends On

- `05-02-backend-foundation-and-policy`
- `.trellis/spec/backend/directory-structure.md`
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/quality-guidelines.md`

## Scope

- 实现 tool runner 与执行元数据记录
- 基于强度级别映射工具参数
- 实现资产发现工作流
- 实现端口/服务识别工作流
- 实现漏洞扫描工作流
- 实现弱口令扫描工作流
- 正确处理取消、超时、失败、部分成功

## Out of Scope

- 邮件分析
- 日志接入/聚合
- 前端展示层

## Acceptance Criteria

- 不允许直接执行 LLM 或用户提供的原始 shell 字符串
- 扫描范围不会因发现结果自动越权扩展
- 成功步骤结果在 `PARTIAL_SUCCESS` 场景下可保留
- 高风险执行必须服从确认与权限边界
- 每次执行均记录工具版本、参数映射结果、状态与审计信息
