# frontend: Dashboard、审计与管理配置

## Objective

实现 dashboard、大屏指标、审计轨迹、以及管理配置界面，确保权限与文本可访问性要求落地。

## Depends On

- `05-02-backend-foundation-and-policy`
- `05-02-backend-log-ingestion-and-dashboard-api`
- `05-02-frontend-task-console-and-scope`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/hook-guidelines.md`
- `.trellis/spec/frontend/quality-guidelines.md`

## Scope

- dashboard 汇总指标与趋势视图
- 审计日志查询/浏览界面
- LLM / 工具 / 邮件 / 日志源等管理配置界面
- 权限不足、无数据、系统错误等状态显式呈现

## Acceptance Criteria

- dashboard 提供文本摘要，不依赖纯图表表达关键状态
- 审计与配置界面遵守权限 gating
- dashboard 默认刷新节奏符合 60 秒要求
- 管理配置变更具备明确确认与反馈语义
