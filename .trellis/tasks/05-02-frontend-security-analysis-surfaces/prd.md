# frontend: 漏洞、弱口令、邮件与日志分析界面

## Objective

实现漏洞结果、弱口令结果、邮件分析结果、日志分析结果等面向分析员的业务界面，并正确表达遮蔽、临时可见窗口与风险状态。

## Depends On

- `05-02-backend-workflow-execution`
- `05-02-backend-mail-reports-and-exports`
- `05-02-backend-log-ingestion-and-dashboard-api`
- `05-02-frontend-task-console-and-scope`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/state-management.md`
- `.trellis/spec/frontend/type-safety.md`
- `.trellis/spec/frontend/quality-guidelines.md`

## Scope

- 漏洞结果列表与详情
- 弱口令结果列表、遮蔽显示、临时明文显示窗口
- 邮件分析详情视图
- 日志分析页面与脱敏事件展示

## Acceptance Criteria

- 敏感或遮蔽字段不会被当作普通字符串展示
- 临时明文展示不会持久化到本地存储、URL 或全局状态
- 日志分析界面只消费脱敏/聚合数据
- 邮件与扫描结果页面能正确呈现失败、部分成功、不可见原因
