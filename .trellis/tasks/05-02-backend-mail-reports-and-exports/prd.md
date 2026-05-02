# backend: 邮件分析、报表与导出

## Objective

实现钓鱼邮件接收、分析、标记、转发链路，以及报表/导出能力中的敏感边界控制。

## Depends On

- `05-02-backend-foundation-and-policy`
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/quality-guidelines.md`

## Scope

- 邮件接收与解析基础链路
- 邮件正文与附件分析决策
- 安全标签与转发逻辑
- 报表生成与导出申请
- 敏感导出控制、审计与可见性边界

## Critical Rules

- 单封邮件超过 `50 MB` 时：继续转发、仅分析正文、跳过附件分析并明确标记。
- 应用日志中不得记录完整邮件正文转储。
- 敏感导出必须有权限校验与审计。

## Acceptance Criteria

- 邮件分析链路支持正文/附件分析决策与转发状态回写
- 超过阈值邮件符合 `50 MB` 规则
- 报表导出支持权限控制、遮蔽与必要审计
- 不落库存储明文弱口令或不必要的敏感正文内容
