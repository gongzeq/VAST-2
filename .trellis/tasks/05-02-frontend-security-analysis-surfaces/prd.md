# frontend: 漏洞、弱口令、邮件与日志分析界面（Tracker）

## Status

**This task is now a tracker.** 所有页面 / hook / MSW handler / 验收标准均下放到 4 个子任务。本 PRD 只承担：
1. 4 个子任务共享的**契约镜像策略**与**基础设施约定**
2. 子任务清单与依赖顺序
3. 跨子任务的**一致性条款**（共享视觉语言 / 共享 sensitive display 规则 / 共享 URL state 规范）

## Children

| Child Task | Domain | Backend Contract | Sensitive Concerns |
|---|---|---|---|
| `05-04-frontend-vulnerability-surface` | 漏洞 | `vulnerability/contracts/vulnerability.contract.ts` | 中：CVE / evidence 文本，无明文密钥 |
| `05-04-frontend-weak-password-surface` | 弱口令 | `report/contracts/report.contract.ts`（masked / cleartext / export 命令） | **极高**：明文窗口、一次性密码、XLSX 加密导出、auditor 拒绝 |
| `05-04-frontend-mail-analysis-surface` | 邮件 | `phishing-mail/contracts/mail-analysis.contract.ts` | 中：raw body 不展示、`UNAVAILABLE` / `BODY_ONLY_SIZE_LIMIT` 边缘态 |
| `05-04-frontend-log-analysis-surface` | 日志 | `log-ingestion/contracts/log-ingestion.contract.ts` | 中：`redactedFields[]` 显式标注、不渲染原文 |

## Suggested Implementation Order

1. **漏洞**（最简单、无敏感临时 state，可作为四个域的共享 pattern 验证）
2. **邮件**（中等复杂，需要把"不可见原因"显式分支化，验证 component spec 的 stateful render 规则）
3. **日志**（中等复杂，引入 URL state 时间窗口与趋势聚合面板的共享 pattern）
4. **弱口令**（最复杂，建立在前 3 个域的 masked / sensitive display / 共享 URL state 之上；明文窗口 + 一次性密码 + XLSX 加密导出是本批次最高敏感的单元）

## Shared Constraints (子任务必须遵守)

### 1. 契约镜像

- 4 个子任务各自镜像所属契约到 `web/src/shared/contracts/{vulnerability,mail-analysis,log-ingestion,weak-password-export}.contract.ts`
- **不直接 import 后端 src/**；保持字段与 enum 与后端一致
- 所有 MSW 响应必经 `*.parse()`；解析失败 → `unknown state` 恢复视图

### 2. 共享 UI 语汇（沿用 `task-console-and-scope` 已建立的）

- `<StatusBadge>` 词汇统一：`SUCCESS` / `PARTIAL_SUCCESS` / `FAILED` / `BLOCKED` / `CANCELLED` / `MASKED` / `UNAVAILABLE`
- `<EmptyState>` / `<UnauthorizedState>` 严格区分：**未授权动作必须显式呈现"无 xxx 权限"，不得 fallback 为空表 / 空卡片**
- 不可用色彩单独传达状态（与 frontend spec component-guidelines.md 对齐）

### 3. URL state 规范（统一）

- 列表 filter / sort / pagination / 时间窗口 → URL search params；用 zod 解析
- query key 形如 `['vulnerability-findings', filters]` / `['mail-analyses', filters]` / `['security-log-events', filters]` / `['weak-password-findings-by-task', taskId]`

### 4. Sensitive Display 规则（跨子任务硬约束）

- 任何敏感临时 state（明文密码、一次性导出密码）只允许 **React local state + `useRef` + dialog scope**
- 禁止：`localStorage` / `sessionStorage` / URL params / `ActorContext` / TanStack Query cache 写入敏感临时 state
- 路由切换 / dialog 关闭 / tab 切到后台 / 标签页关闭 → 敏感临时 state 必须立即清空
- 后端宣告窗口过期（`expiresAt` 已过）→ 前端立即清空缓存的敏感显示

### 5. 角色权限边界（跨子任务硬约束）

- `auditor`：只读，不得看明文弱密码、不得触发任何导出动作；UI 必须呈现"无 `xxx` 权限"占位（不得隐藏按钮）
- `viewer`（管理层）：不得看敏感原始输出 / 邮件 metadata / 明文密码 / 工具原始输出；列表 / 详情入口对其不可达
- `security-engineer`：在已授权资产范围内可见；明文弱密码限于自己发起任务窗口内
- 权限点参考：`raw_evidence:view` / `log_event:export` / `report:export`（独立权限点）

## Dependencies

- **前置**：`05-02-frontend-task-console-and-scope` 必须完成 `App / router / Providers / MSW worker / fetch helper / ActorProvider / shared/components 基础组件`，否则 4 个子任务无法独立落地
- **后置**：`05-02-integration-and-quality-verification` 的 contracts-parity 脚本会校验本批次 4 份契约镜像与后端是否漂移

## Acceptance Criteria（Tracker 级，子任务全部完成时统一收尾）

- [ ] 4 个子任务全部 status=completed 并归档
- [ ] 跨子任务的视觉语汇 / sensitive display 规则 / URL state 规范一致（评审清单自检）
- [ ] `cd web && npm run typecheck && npm run test && npm run build` 全绿（覆盖 4 域）
- [ ] 4 份契约镜像与后端契约的字段 / enum 一一对应（contracts-parity 通过）

## Out of Scope（Tracker 级）

- 漏洞 status 状态机变更（OPEN→MITIGATED）—— 后续独立任务
- 邮件回放 / 主动隔离 / 阻断
- 日志源配置 / 解析格式管理 —— 属 `frontend-dashboard-audit-and-admin`
- LLM 风险解释面板（漏洞 / 邮件 LLM 摘要展示）
- 真实 SMTP / Syslog 接入（一律 MSW）
- 国际化 / 深色模式
- 告警与通知

## Technical Notes

- 平台 PRD：`.trellis/tasks/05-01-security-analysis-platform-prd/prd.md`
- 父任务 PRD：`.trellis/tasks/05-02-security-analysis-platform-mvp/prd.md`
- 兄弟任务（依赖）：`.trellis/tasks/05-02-frontend-task-console-and-scope/prd.md`
- frontend spec：`.trellis/spec/frontend/{component-guidelines,state-management,type-safety,quality-guidelines,hook-guidelines,directory-structure}.md`
- 后端契约源文件：
  - `src/modules/vulnerability/contracts/vulnerability.contract.ts`
  - `src/modules/phishing-mail/contracts/mail-analysis.contract.ts`
  - `src/modules/log-ingestion/contracts/log-ingestion.contract.ts`
  - `src/modules/report/contracts/report.contract.ts`
