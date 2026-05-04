# frontend: Dashboard、审计与管理配置

## Goal

实现 MVP 的三个聚合性运营面：
1. **Dashboard**：跨域汇总 7 类指标 + 文本摘要（任务态势 / 资产态势 / 漏洞态势 / 弱口令态势 / 钓鱼邮件态势 / YOLO·智能体态势 / 日志攻击态势），60s 准实时刷新，资产组 filter
2. **Audit 审计轨迹**：多维 filter（actor / action / target / 时间窗口 / 状态）+ 严格 permission gating（`audit_log:view`）
3. **Admin 配置**：LLM Provider / 工具配置 / 日志源 / 邮件源 / kill switch 五块管理面，permission-aware UX，**占位写**（MSW 内存可写 + 二次确认 dialog）

后端 dashboard 6/7、audit 查询、admin 5 块契约目前都不存在；本任务**前端先行 + MSW 兜底**，由 `05-02-integration-and-quality-verification` 在后端补齐后走 contracts-parity 校验。

## Decisions (locked)

- **D1 [Q1 ✅]** 前端先行 + MSW 兜底。前端在 `web/src/shared/contracts/` 建立：
  - `dashboard-summary.contract.ts`（7 类指标 zod schema）
  - `audit-log.contract.ts`（audit log 查询契约 + filter schema）
  - `admin-config.contract.ts`（LLM Provider / 工具配置 / 日志源 / 邮件源 / kill switch 5 个独立 schema）
  - 字段名 / enum 严格按平台 PRD §3 / §11 / §12 + `actor-context.contract.ts` 已有 enum 定义
- **D2 [Q2 ✅]** Dashboard 7 类指标全做（PRD §11 完整对齐）
- **D3 [Q3 ✅]** Admin 配置面占位写：MSW 内存可写 + 列表/详情/启停/保存/删除完整 UI + 二次确认 dialog + diff 摘要 + 成功失败反馈
- **D4 [Q4 ✅]** kill switch 在 admin 顶部独立卡片，状态显示 + 输入 `CONFIRM` 文本二次确认；仅 `kill_switch:operate` 可点击；其他角色显式占位"无 kill switch 操作权限"
- **D5 [Q5 ✅]** Dashboard 7 类指标卡片每张都带 1–2 句文本摘要（不依赖纯图表表达关键状态）
- **D6 [Expansion ✅]** 纳入 MVP：Dashboard 资产组 filter；Audit 多维 filter
- **D7 [Expansion ✅]** 延后：Audit 导出 CSV/JSON（独立任务，需后端 `audit_log:export` contract 先行）

## Requirements

### R1 路由与权限 gating

- 新增路由：
  - `/dashboard` → DashboardPage（任意已登录 actor 可见，但卡片内容随权限点 mask）
  - `/audit` → AuditLogPage（`RequireAuditLogView` gate；无权限显式占位"无 audit_log:view 权限"，**不得隐藏导航**）
  - `/admin/llm-providers` / `/admin/tool-configs` / `/admin/log-sources` / `/admin/mail-sources` / `/admin/kill-switch` → 5 个 admin 子页（`RequireAdminConfig` gate；非 admin 显式占位）
- 新增权限 hook：
  - `useCanViewAuditLog()` → 检查 `audit_log:view`
  - `useCanManageAdminConfig()` → 任一 `llm_provider:manage` / `tool_config:manage` / `log_source:manage` / `asset_group:manage`
  - `useCanOperateKillSwitch()` → `kill_switch:operate`
- 顶层导航（`AuthenticatedLayout`）增加 Dashboard / Audit / Admin 入口；权限不足项**仍显示但置灰**并 tooltip 说明缺哪个权限点

### R2 Dashboard（7 类指标 + 摘要 + 刷新 + filter）

- 顶部资产组 selector（多选 + "全局"toggle，URL state via `?assetGroupIds=...&scope=global|owned`，zod 解析）
- 7 类指标卡片每张包含：
  - 标题 + key metrics（数字 + mini sparkline）
  - 1–2 句中文文本摘要
  - "查看详情"链接到对应 surface（如漏洞态势→`/vulnerabilities`）
- 默认 60s `refetchInterval`；Tab 不可见时（`document.visibilityState='hidden'`）暂停刷新
- 7 类指标对应一个 query key：`['dashboard-summary', { assetGroupIds, scope }]`
- 任一卡片在权限不足时降级为 `<UnauthorizedState>`（如 viewer 不可见弱口令明文统计字段，但仍可见脱敏的资产数）
- MSW handler 提供 demo 数据，覆盖：
  - 任务态势：今日/运行中/SUCCESS/PARTIAL/FAILED/BLOCKED 计数 + 平均耗时
  - 资产态势：授权资产组数 / 发现资产 / 存活资产 / 新增资产 / 暴露端口 Top 服务
  - 漏洞态势：高/中/低危计数 + Top 漏洞类型 + Top 风险资产 + 模板命中趋势
  - 弱口令态势：弱口令资产数 + 服务类型分布 + 趋势（**不含明文密码字段**）
  - 钓鱼邮件态势：今日量 + 疑似量 + 风险评分分布 + Top 诱导类型 + Top URL/域名 + 附件类型分布
  - YOLO·智能体态势：自然语言任务数 / YOLO 直接执行 / 澄清次数 / 白名单阻断
  - 日志攻击态势：防火墙/Web 事件量 + 攻击趋势图 + Top 攻击类型 + Top 来源 IP + Top 目标资产 + 动作分布 + URI/方法/状态码分布 + 异常峰值提示

### R3 Audit 审计轨迹

- 多维 filter（URL state via search params，zod 解析）：
  - actor（user 名 / role 多选）
  - action（enum 多选：task.create / task.execute / asset.confirm / config.update / kill_switch.operate / weak_password.view 等）
  - target（资源类型 + ID 模糊匹配）
  - 时间窗口（`since` / `until` ISO datetime，zod parse）
  - 状态（SUCCESS / FAILURE / BLOCKED）
- 列表分页（`page` / `pageSize`）+ 默认按时间倒序
- 详情 dialog（点击行展开）：展示完整 payload（`requestPayload` / `validationResult` / `affectedResources`）
- 敏感字段渲染规则：
  - 涉及明文弱密码的 audit 记录：明文字段始终 mask（PRD §7.5/§12 硬约束："审计日志不能包含明文密码"）
  - 涉及原始日志正文的记录：原文字段必为 `unavailable`
- 无 `audit_log:view` 权限：`/audit` 路由直接渲染 `<UnauthorizedState>` 占位（不重定向）
- query key：`['audit-log', filters]`

### R4 Admin 配置

#### R4.1 LLM Provider（`/admin/llm-providers`）

- 列表：name / type（local/openai-compatible/claude-compatible）/ status（enabled/disabled）/ baseUrl / 最后变更人 / 时间
- 详情 dialog：基础配置 + 启停 toggle + 删除按钮
- 新建/编辑 form：name / type / baseUrl / apiKey（write-only，不回显，仅 `••••` 占位）/ purpose（intent-recognition / plan-generation / explanation / report-draft 多选）
- 保存：二次确认 dialog 显示 diff 摘要 → POST/PUT MSW → toast 反馈
- 权限：`llm_provider:manage`

#### R4.2 Tool Configs（`/admin/tool-configs`）

- 列表：tool（Subfinder/Httpx/Nmap/Nuclei/Hydra/emlAnalyzer/Magika）+ version + path + 强度档位（low/medium/high）配置摘要
- 详情：每档（low/medium/high）展开（并发 / 速率 / 超时 / 端口范围 / 模板集 / 爆破上限）只读字段或可编辑（按工具）
- 高强度档位修改保存时额外 warning："高强度不可被 YOLO 跳过"
- 权限：`tool_config:manage`

#### R4.3 Log Sources（`/admin/log-sources`）

- 列表：source_id / 日志类型（firewall/web）/ 产品类型 / 协议（TCP/UDP/TLS Syslog 或 HTTP push）/ 解析格式 / 所属资产组 / 启停 / 健康状态
- 详情：监听地址 / 端口 / 证书配置占位 / 来源 IP 允许列表 / 脱敏事件保留周期 / 聚合指标保留周期
- 新建/编辑：完整 form + 解析格式 dropdown（Syslog / Nginx access / Nginx error / Apache access / Apache error / JSON）
- 启停 toggle 二确认（停用会终止日志接收）
- 权限：`log_source:manage`

#### R4.4 Mail Sources（`/admin/mail-sources`）

- 列表：name / 上游入站来源 / 下游真实邮箱服务器 / 启停 / 最近接收数
- 详情：上游 host/port / 下游 host/port / TLS 配置占位 / 邮件大小上限 / fail-open 策略说明
- 新建/编辑 form
- 权限：admin 角色（PRD §3 未独立权限点，使用 admin 默认）

#### R4.5 Kill Switch（`/admin/kill-switch`）

- 顶部独立大卡片：当前状态（running 绿 / stopped 红）+ 最后操作人 + 时间 + 影响范围说明（停止扫描工具与辅助命令；不影响邮件网关与日志接收）
- 切换按钮：必须输入 `CONFIRM`（区分大小写）才能 enable，否则 disabled
- 触发后再次确认 → POST MSW → toast + 状态翻转
- 权限：`kill_switch:operate`；其他角色卡片显示但按钮区域替换为 `<UnauthorizedState text="无 kill_switch:operate 权限">`

### R5 共享约束（与兄弟前端任务一致）

- 镜像契约 + `*.parse()` 强校验，失败 → unknown state
- 列表 filter / 时间窗口 / 分页走 URL search params（zod 解析）
- 不可用色彩单独传达状态；StatusBadge 词汇统一
- `<EmptyState>` / `<UnauthorizedState>` 严格区分；权限不足必须显式呈现"无 xxx 权限"

## Acceptance Criteria

- [ ] 路由 `/dashboard` `/audit` `/admin/{llm-providers,tool-configs,log-sources,mail-sources,kill-switch}` 全部就绪，对应 permission gate 起作用
- [ ] Dashboard 7 类指标卡片均显示 demo 数据 + 文本摘要 + mini 图；资产组 filter 可工作（URL state 同步）
- [ ] Dashboard 默认 60s 自动刷新；Tab 不可见时暂停
- [ ] Audit 多维 filter（actor/action/target/time/status）+ 分页 + 详情 dialog 工作
- [ ] Audit 涉及明文弱密码的字段始终 mask；权限不足显式 `<UnauthorizedState>`（不重定向）
- [ ] Admin 5 块（LLM Provider / Tool / Log Source / Mail Source / Kill Switch）列表 + 新建/编辑/删除/启停 全部走 MSW 内存写并能 round-trip 显示
- [ ] kill switch 触发需输入 `CONFIRM`；非 `kill_switch:operate` 角色看到 `<UnauthorizedState>` 占位
- [ ] 三块页面的所有 fetch 走 `*.parse()`；解析失败显示 unknown state
- [ ] 镜像契约文件 3 份（dashboard-summary / audit-log / admin-config）落地，导出在 `web/src/shared/contracts/index.ts`
- [ ] MSW handler 增加 5 个文件：`dashboard-handlers.ts` / `audit-log-handlers.ts` / `admin-config-handlers.ts`（合并 5 块或按块拆 — 视实现复杂度，**默认按 5 块拆**：`admin-llm-provider-handlers.ts` / `admin-tool-config-handlers.ts` / `admin-log-source-handlers.ts` / `admin-mail-source-handlers.ts` / `admin-kill-switch-handlers.ts`）
- [ ] `cd web && npm run typecheck && npm run test && npm run build` 全绿
- [ ] 新增 hooks：`useCanViewAuditLog` / `useCanManageAdminConfig` / `useCanOperateKillSwitch` 单元测试覆盖

## Definition of Done

- 上述所有 Acceptance Criteria 通过
- 镜像契约字段名 + enum 与平台 PRD §3 / §11 / §12 严格对齐（reviewer 自检表）
- frontend spec（component / hook / quality / type-safety / mock-api-conventions / directory-structure）零违反
- 与兄弟前端任务的视觉语汇 / sensitive display / URL state / EmptyState/UnauthorizedState 约定一致（评审清单自检）
- 新代码无 `localStorage` / `sessionStorage` 写入敏感字段；admin 写操作 100% 走 MSW handler 而非组件直接 mutate db

## Out of Scope

- 后端 dashboard 6 类聚合接口、audit 查询接口、admin 配置 5 类持久化的真实实现（属后续后端任务）
- Audit 导出 CSV/JSON（独立任务，依赖后端 `audit_log:export` contract）
- 真实 LLM Provider 连通性测试 / 工具版本探测 / 日志源 health check 探活
- 报告导出 UI（属 reports）
- 大屏 3D / 粒子效果（PRD §11 显式排除）
- Admin 乐观更新 + 多人冲突处理
- 国际化 / 深色模式
- 告警与通知
- 资产组管理（属 `asset-scope`，已存在）

## Technical Approach

### 目录与组件分布

```
web/src/
├── app/
│   ├── router/router.tsx                                # 增加 7 条路由 + 3 个 RequireXXX gate
│   ├── layouts/authenticated-layout.tsx                 # 顶层 nav 增 Dashboard / Audit / Admin
│   └── msw/
│       ├── db.ts                                        # 增 dashboardSummary / auditLog / 5 类 admin 集合
│       └── handlers/
│           ├── dashboard-handlers.ts
│           ├── audit-log-handlers.ts
│           ├── admin-llm-provider-handlers.ts
│           ├── admin-tool-config-handlers.ts
│           ├── admin-log-source-handlers.ts
│           ├── admin-mail-source-handlers.ts
│           └── admin-kill-switch-handlers.ts
├── shared/
│   ├── contracts/
│   │   ├── dashboard-summary.contract.ts                # 7 类指标 zod schema
│   │   ├── audit-log.contract.ts
│   │   ├── admin-config.contract.ts                     # 5 块的 schema 集合
│   │   └── index.ts                                     # 增导出
│   ├── api/query-keys.ts                                # 增 dashboard / audit / admin keys
│   └── hooks/                                           # 增 3 个权限 hook
└── features/
    ├── dashboard/
    │   ├── routes/dashboard-page.tsx
    │   ├── components/                                  # 7 类指标卡片 + 资产组 filter
    │   ├── hooks/use-dashboard-summary.ts
    │   └── api/
    ├── audit/
    │   ├── routes/audit-log-page.tsx
    │   ├── components/                                  # filters / table / detail-dialog
    │   ├── hooks/
    │   └── api/
    └── admin-settings/
        ├── routes/                                      # 5 个子页
        ├── components/llm-providers/                    # 各块独立子目录
        ├── components/tool-configs/
        ├── components/log-sources/
        ├── components/mail-sources/
        ├── components/kill-switch/
        ├── hooks/
        └── api/
```

### 实现顺序（small PRs / 子提交）

1. **PR1 contracts + MSW + nav skeleton**：3 份镜像契约 + MSW handler 骨架 + 顶层 nav + 7 个空 page + 3 个 RequireXXX gate
2. **PR2 Dashboard（最易，纯只读）**：7 类卡片 + 文本摘要 + 资产组 filter + 60s refetch
3. **PR3 Audit（中等，filter + dialog）**：多维 filter + 列表分页 + 详情 dialog + 敏感字段 mask
4. **PR4 Admin 5 块（最复杂，5 块写交互）**：按块顺序 LLM Provider → Tool → Log Source → Mail Source → Kill Switch
5. **PR5 收口**：测试补齐 / typecheck-test-build 全绿 / 兄弟视觉语汇一致性自检

## Decision (ADR-lite)

**Context**: 本任务依赖后端 dashboard 6 类聚合 / audit 查询 / admin 配置 5 类共 12+ 块契约，但后端这些契约目前不存在；按 Wave 3 目标本任务必须本批次交付。

**Decision**: 前端先行建立完整契约镜像 + MSW 兜底实现端到端 UX；后端补齐由 `05-02-integration-and-quality-verification` 用 contracts-parity 校验。Admin 写操作走 MSW 内存可写。Dashboard 7 类全做（PRD §11 严格对齐）。Kill switch 用独立卡片 + CONFIRM 文本二次确认（最高风险动作）。

**Consequences**:
- ✅ Wave 3 时间表不被阻塞
- ✅ 前端 UX 一次到位，后端补齐时只需切换 fetch 来源
- ⚠️ 镜像契约需在后端补齐时谨慎核对字段名/enum，contracts-parity 是关键防线
- ⚠️ Admin 占位写不持久（页面刷新后回到初始 demo 状态），用户需理解这是 MSW 模拟
- ⚠️ Dashboard demo 数据要"看上去合理"以便演示与设计 review

## Technical Notes

- 平台 PRD：`.trellis/tasks/05-01-security-analysis-platform-prd/prd.md`（§3 权限点 / §11 Dashboard / §12 Audit）
- 父 MVP PRD：`.trellis/tasks/05-02-security-analysis-platform-mvp/prd.md`
- 已完成兄弟（基础设施）：`.trellis/tasks/05-02-frontend-task-console-and-scope/`
- 平行兄弟（共享视觉语汇）：`.trellis/tasks/05-02-frontend-security-analysis-surfaces/` 及其 4 个子任务
- 后端契约源现状：
  - ✅ `src/modules/dashboard/contracts/dashboard-read.contract.ts` 仅日志态势 1 类（前端 dashboard-summary 包含此结构作为子集）
  - ⚠️ `src/modules/audit/persistence/in-memory-audit-log.ts` 无 contracts/，前端先行
  - ⚠️ Admin 5 块零模块，前端先行
  - ✅ `src/modules/auth/contracts/actor-context.contract.ts` 提供权限点 enum 来源
- frontend spec：`.trellis/spec/frontend/{component-guidelines,state-management,type-safety,quality-guidelines,hook-guidelines,directory-structure,mock-api-conventions}.md`
- 后置依赖：`05-02-integration-and-quality-verification` 必须扩展 contracts-parity 脚本覆盖 dashboard-summary / audit-log / admin-config 3 份镜像契约
