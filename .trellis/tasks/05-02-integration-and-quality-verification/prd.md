# integration: 联调、测试与质量验收

## Objective

对 backend/frontend 任务进行联调，补齐自动化验证与手工验收路径，并检查实现是否仍与 PRD 和 Trellis spec 一致。

## Depends On

- 所有实现子任务完成主要功能后开始
- `.trellis/spec/backend/quality-guidelines.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`

## Scope

- 核心端到端流程联调
- API 契约与错误响应核对
- 状态流转与权限边界核对
- lint / type-check / tests / e2e
- PRD 与 spec 覆盖检查

## Priority Flows

- 任务创建 -> 澄清 -> 计划预览 -> 确认 -> 执行 -> 结果展示
- 资产发现与范围确认
- 漏洞/弱口令扫描结果展示与导出
- 邮件分析与超过 `50 MB` 场景
- 日志接入 -> 脱敏 -> 聚合 -> dashboard

## Acceptance Criteria

- 关键流程具备自动化测试或明确可重复的人工验收步骤
- lint / type-check / tests 通过
- 不存在违反 spec 的敏感数据持久化、展示或日志记录路径
- PRD 核心需求都能映射到实现任务与验收项
