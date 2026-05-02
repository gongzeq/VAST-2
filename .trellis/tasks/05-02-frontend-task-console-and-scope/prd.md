# frontend: 任务控制台、澄清确认与资产范围

## Objective

实现面向分析员的核心交互入口：自然语言任务创建、澄清问题、计划预览、确认执行、任务详情核心状态，以及资产范围管理界面。

## Depends On

- `05-02-backend-foundation-and-policy`
- `.trellis/spec/frontend/directory-structure.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/hook-guidelines.md`
- `.trellis/spec/frontend/state-management.md`
- `.trellis/spec/frontend/type-safety.md`
- `.trellis/spec/frontend/quality-guidelines.md`

## Scope

- 任务控制台页面
- 澄清问题展示与回答
- 计划预览与确认执行 UI
- 任务详情核心状态与时间线
- 资产组与白名单范围管理页面
- 权限/遮蔽/错误态的显式呈现

## Acceptance Criteria

- `BLOCKED`、`NEEDS_CLARIFICATION`、`PARTIAL_SUCCESS` 等状态在 UI 中显式区分
- 高风险操作必须先预览再确认
- URL / server / local / sensitive temporary state 边界清晰
- React + TypeScript 组件与 hooks 契约符合 frontend spec
