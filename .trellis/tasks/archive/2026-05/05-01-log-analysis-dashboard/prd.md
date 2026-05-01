# brainstorm: 日志分析大屏功能

## Goal

在现有智能网络安全分析平台任务说明中补充日志分析能力，使平台能够自动接入并分析防火墙日志、Web 日志，无需安全工程师手动导入日志文件，并将攻击趋势、攻击类型、来源、目标和处置动作等指标汇总到安全大屏中。

## What I already know

* 原任务说明面向企业内部安全团队，核心入口是自然语言智能体，但安全工具执行、权限、白名单、审计和大屏指标都由后端受控实现。
* 现有 MVP 已包含任务、资产、漏洞、弱口令、钓鱼邮件、YOLO / 智能体 6 类大屏指标。
* 现有说明明确不做复杂 SIEM 关联分析、攻击溯源画像和 3D 攻击动画。
* 用户要求新增日志分析功能，重点是自动分析防火墙日志和 Web 日志，不需要手动导入，并从日志中分析攻击趋势图展示在大屏。
* 本地当前主要是任务说明文档和 Trellis 配置，没有应用源码，因此本次先更新需求说明和 PRD。

## Assumptions (temporary)

* MVP 先做日志归一化、基础攻击分类和趋势聚合，不做完整 SIEM 规则引擎、跨源复杂关联和自动攻击者画像。
* 日志分析结果可以与资产库做弱关联：目标 IP / 域名命中已授权资产时展示资产上下文，未命中时只作为日志事件展示，不自动扩大资产授权范围。

## Open Questions

* None.

## Requirements (evolving)

* 平台应新增日志自动分析能力，覆盖防火墙日志和 Web 日志。
* 防火墙日志、Web 日志不依赖安全工程师手动上传或手动导入文件。
* 系统应对日志做时间、来源、目标、动作、协议、端口、URL、状态码、规则命中、严重级别等字段归一化。
* 系统应基于规则和结构化字段识别常见攻击类型，例如扫描探测、暴力破解、SQL 注入、XSS、目录遍历、命令执行、敏感路径访问、异常 4xx / 5xx 激增等。
* 系统应保留原始日志证据或可追溯引用，同时展示结构化分析结果。
* 系统应在大屏新增日志攻击态势指标，至少包含攻击趋势图、Top 攻击类型、Top 来源、Top 目标资产、处置动作分布和 Web 攻击 URI / 状态码分布。
* 日志分析不得替代资产白名单授权，不得因发现日志目标自动扩大扫描范围。
* 外部 LLM Provider 不应直接接触敏感原始日志；如需 LLM 总结，应优先使用脱敏后的聚合结果。
* MVP 日志接入方式锁定为平台提供 Syslog / 日志接收端，由防火墙、WAF、Nginx / Apache 主动转发；轻量采集 Agent 作为可选扩展，不作为 MVP 必需项。

## Acceptance Criteria (evolving)

* [ ] 任务说明中新增日志自动分析工作流，覆盖防火墙日志和 Web 日志。
* [ ] 任务说明明确日志无需手动导入，并给出自动接入方式。
* [ ] 大屏展示章节从 6 类指标扩展为包含日志攻击态势的指标集合。
* [ ] 验收标准新增日志自动分析和攻击趋势大屏场景。
* [ ] MVP 范围、明确不做、审计要求、模块影响面和 Trellis 拆解方向同步补充日志分析相关内容。
* [ ] LLM 能力边界明确限制未经脱敏的原始日志进入 LLM 上下文。

## Definition of Done (team quality bar)

* Tests added/updated if implementation follows this PRD.
* Lint / typecheck / CI green if implementation follows this PRD.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 复杂 SIEM 关联分析。
* 攻击者画像或攻击溯源结论。
* 3D 地球攻击动画或无业务价值的可视化效果。
* 基于日志自动发起阻断、封禁或扫描。
* 手动日志文件上传作为 MVP 主路径。

## Technical Approach

MVP 采用“平台接收端 + 设备/服务主动转发”的日志接入方式。平台提供 Syslog / 日志接收端，接收防火墙、WAF、Nginx / Apache 等来源主动转发的日志流；日志进入后先落原始证据或可追溯引用，再做字段归一化、攻击分类和趋势聚合。采集 Agent 作为后续扩展点保留，不进入 MVP 必需范围。

## Decision (ADR-lite)

**Context**: 日志分析必须无需人工导入，同时要兼容企业常见防火墙、WAF 和 Web 服务日志来源。

**Decision**: MVP 选择平台提供 Syslog / 日志接收端，并由防火墙、WAF、Nginx / Apache 主动转发日志；采集 Agent 作为可选扩展。

**Consequences**: 这种方案部署门槛相对低，符合常见安全设备日志转发方式，也避免在 MVP 中维护多平台采集 Agent。代价是需要在日志源侧配置转发，并在后续版本补充 Agent 以覆盖不能主动转发的主机或应用。

## Technical Notes

* Inspected `trellis_security_analysis_platform_task.md`.
* Existing dashboard section currently lists 6 metric categories; log attack posture should be added as a seventh category or a clearly named additional category.
* Existing security boundaries already emphasize evidence, audit, LLM limits, and no unauthorized scope expansion; log analysis should inherit those constraints.
