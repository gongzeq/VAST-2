# backend: 日志接入、脱敏与 Dashboard API

## Objective

实现日志源配置、日志接入、解析、脱敏、聚合，以及供 dashboard / report / LLM 使用的只读 API。

## Depends On

- `05-02-backend-foundation-and-policy`
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/backend/logging-guidelines.md`
- `.trellis/spec/backend/quality-guidelines.md`

## Scope

- 日志源配置管理
- Syslog / 接收端点
- 解析与标准化事件映射
- 敏感字段脱敏
- 聚合指标与趋势桶
- 面向 dashboard/report 的只读查询 API

## Critical Rules

- 原始日志正文不得持久化。
- 仅允许保存 ingest metadata、脱敏后的结构化事件、聚合指标。
- dashboard 与 LLM 只能消费脱敏/聚合数据。

## Acceptance Criteria

- 支持接收、解析、脱敏、聚合的基本闭环
- 解析失败时仍保留 ingest metadata，但必须丢弃原始日志正文
- API 不暴露 raw log body、敏感 query/header/token
- 未匹配或未授权资产不会被自动加入扫描范围
