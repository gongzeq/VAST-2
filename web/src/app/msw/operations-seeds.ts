/**
 * Seed data for the operations surfaces (dashboard / audit / admin).
 * All values are demo-only; backend will replace them when real contracts ship.
 */
import type {
  AuditLogEntry,
  DashboardSummary,
  KillSwitchState,
  LlmProvider,
  LogSource,
  MailSource,
  ToolConfig,
} from '@/shared/contracts';

function nowIso(offsetSeconds = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function trend(values: number[], offsetSecondsPerBucket: number) {
  return values.map((value, index) => ({
    bucketAt: nowIso(-(values.length - index) * offsetSecondsPerBucket),
    value,
  }));
}

// ---------------------------------------------------------------------------
// Dashboard summary — one fixed snapshot covering the seeded asset groups.
// ---------------------------------------------------------------------------

export function seedDashboardSummary(): DashboardSummary {
  return {
    generatedAt: nowIso(),
    scope: 'owned',
    assetGroupIds: ['ag_corp_internal', 'ag_corp_public'],
    categories: [
      {
        kind: 'task',
        summary: '今日 12 个任务，2 个运行中、9 个成功、1 个部分成功，平均耗时约 3 分钟。',
        todayTaskCount: 12,
        runningTaskCount: 2,
        byState: [
          { state: 'SUCCESS', count: 9 },
          { state: 'PARTIAL_SUCCESS', count: 1 },
          { state: 'FAILED', count: 0 },
          { state: 'BLOCKED', count: 0 },
          { state: 'NEEDS_CLARIFICATION', count: 0 },
          { state: 'CANCELLED', count: 0 },
        ],
        averageDurationSeconds: 184,
        trend7Days: trend([3, 5, 4, 8, 6, 9, 12], 86_400),
      },
      {
        kind: 'asset',
        summary: '已授权 2 个资产组，发现 18 个资产中 14 个存活；今日新增 3 个待确认资产。',
        authorizedAssetGroupCount: 2,
        discoveredAssetCount: 18,
        liveAssetCount: 14,
        newlyDiscoveredAssetCount: 3,
        exposedPortCount: 27,
        topServices: [
          { service: 'http', count: 9 },
          { service: 'https', count: 7 },
          { service: 'ssh', count: 4 },
          { service: 'mysql', count: 2 },
        ],
      },
      {
        kind: 'vulnerability',
        summary: '高/中/低危合计 12 个；Top 类型为 Path Traversal（5）与 TLS 弱密码（3）。',
        severityCounts: [
          { severity: 'CRITICAL', count: 2 },
          { severity: 'HIGH', count: 3 },
          { severity: 'MEDIUM', count: 4 },
          { severity: 'LOW', count: 3 },
          { severity: 'INFO', count: 0 },
        ],
        topTypes: [
          { vulnerabilityType: 'Path Traversal', count: 5 },
          { vulnerabilityType: 'TLS Weak Cipher', count: 3 },
          { vulnerabilityType: 'Server Version Disclosure', count: 1 },
        ],
        topRiskAssets: [
          { asset: '10.0.0.42', severity: 'CRITICAL', findingCount: 5 },
          { asset: 'api.example.com', severity: 'HIGH', findingCount: 1 },
        ],
        templateHitTrend: trend([2, 3, 4, 4, 5, 6, 7], 86_400),
      },
      {
        kind: 'weak-password',
        summary: '检测出 2 个资产存在弱口令；服务以 ssh / mysql 为主。明文密码不在大屏展示。',
        weakPasswordAssetCount: 2,
        byServiceType: [
          { serviceType: 'ssh', count: 1 },
          { serviceType: 'mysql', count: 1 },
        ],
        trend30Days: trend([0, 1, 1, 2, 2, 1, 2, 2, 1, 2], 86_400 * 3),
      },
      {
        kind: 'mail',
        summary: '今日邮件量 1820 封，疑似钓鱼 24 封；Top 诱导话术为发票催收。',
        todayMailCount: 1820,
        suspectedMailCount: 24,
        riskBucketCounts: [
          { bucket: 'suspected', count: 24 },
          { bucket: 'suspicious', count: 56 },
          { bucket: 'clean', count: 1740 },
        ],
        topInduceTypes: [
          { induceType: '发票催收', count: 8 },
          { induceType: '账户重置', count: 6 },
          { induceType: '快递通知', count: 5 },
        ],
        topUrlDomains: [
          { domain: 'fake-invoice.example', count: 7 },
          { domain: 'login-alerts.example', count: 4 },
        ],
        topAttachmentTypes: [
          { attachmentType: 'pdf', count: 12 },
          { attachmentType: 'docx', count: 5 },
          { attachmentType: 'xlsx', count: 3 },
        ],
      },
      {
        kind: 'yolo',
        summary: '今日通过自然语言创建 18 个任务，YOLO 直接执行 4 次，澄清 5 次，被白名单阻断 1 次。',
        naturalLanguageTaskCount: 18,
        yoloDirectExecutionCount: 4,
        clarificationCount: 5,
        whitelistBlockedCount: 1,
      },
      {
        kind: 'log-attack',
        summary: '过去 1 小时防火墙事件 4321 条，Web 攻击事件 982 条；最近 15 分钟未触发异常峰值。',
        firewallEventCount: 4321,
        webEventCount: 982,
        topAttackTypes: [
          { attackType: 'SQL Injection', count: 312 },
          { attackType: 'Path Traversal', count: 187 },
          { attackType: 'Brute Force', count: 156 },
          { attackType: 'XSS', count: 98 },
        ],
        topSourceIps: [
          { sourceIp: '198.51.100.7', count: 244 },
          { sourceIp: '203.0.113.66', count: 178 },
        ],
        topTargetAssets: [
          { asset: 'api.example.com', count: 421 },
          { asset: '10.0.0.42', count: 122 },
        ],
        actionDistribution: [
          { action: 'BLOCK', count: 642 },
          { action: 'ALLOW', count: 312 },
          { action: 'LOG', count: 28 },
        ],
        topUriPatterns: [
          { uriPattern: '/login', count: 144 },
          { uriPattern: '/admin', count: 98 },
          { uriPattern: '/api/users', count: 71 },
        ],
        httpMethodCounts: [
          { method: 'GET', count: 612 },
          { method: 'POST', count: 348 },
          { method: 'PUT', count: 22 },
        ],
        httpStatusCounts: [
          { status: 200, count: 412 },
          { status: 403, count: 287 },
          { status: 404, count: 198 },
          { status: 500, count: 85 },
        ],
        attackTrend: trend([42, 51, 60, 78, 88, 100, 112, 121, 130, 145, 138, 150], 5 * 60),
        spikeAlert: false,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Audit log — ~40 entries spanning every action × outcome × 7 days.
// ---------------------------------------------------------------------------

interface SeedEntryArgs {
  id: string;
  offsetSeconds: number;
  actorId: string;
  roleIds: string[];
  action: AuditLogEntry['action'];
  targetKind: AuditLogEntry['targetKind'];
  targetId: string;
  outcome: AuditLogEntry['outcome'];
  requestPayload?: AuditLogEntry['requestPayload'];
  validationResult?: AuditLogEntry['validationResult'];
  affectedResources?: AuditLogEntry['affectedResources'];
  clearTextPassword?: AuditLogEntry['clearTextPassword'];
  rawLogBody?: AuditLogEntry['rawLogBody'];
  note?: string | null;
}

function buildEntry(args: SeedEntryArgs): AuditLogEntry {
  return {
    auditLogEntryId: args.id,
    occurredAt: nowIso(args.offsetSeconds),
    actorId: args.actorId,
    roleIds: args.roleIds,
    action: args.action,
    targetKind: args.targetKind,
    targetId: args.targetId,
    outcome: args.outcome,
    requestPayload: args.requestPayload ?? {},
    validationResult: args.validationResult ?? null,
    affectedResources: args.affectedResources ?? [],
    clearTextPassword: args.clearTextPassword ?? null,
    rawLogBody: args.rawLogBody ?? null,
    note: args.note ?? null,
  };
}

export function seedAuditLog(): Map<string, AuditLogEntry> {
  const entries: AuditLogEntry[] = [
    buildEntry({
      id: 'audit_001',
      offsetSeconds: -60,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'task.create',
      targetKind: 'task',
      targetId: 'task_running_demo',
      outcome: 'SUCCESS',
      requestPayload: { workflowType: 'ASSET_DISCOVERY', intensity: 'MEDIUM' },
      validationResult: { whitelistMatched: true },
    }),
    buildEntry({
      id: 'audit_002',
      offsetSeconds: -120,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'task.execute',
      targetKind: 'task',
      targetId: 'task_running_demo',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_003',
      offsetSeconds: -3600,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'task.confirm',
      targetKind: 'task',
      targetId: 'task_running_demo',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_004',
      offsetSeconds: -7200,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'task.create',
      targetKind: 'task',
      targetId: 'task_blocked_demo',
      outcome: 'BLOCKED',
      requestPayload: { target: 'unauthorized.example.org' },
      validationResult: { whitelistMatched: false, reason: 'OUT_OF_SCOPE' },
      note: '目标超出白名单，已阻断。',
    }),
    buildEntry({
      id: 'audit_005',
      offsetSeconds: -10800,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'task.cancel',
      targetKind: 'task',
      targetId: 'task_partial_demo',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_006',
      offsetSeconds: -14400,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'asset.confirm',
      targetKind: 'discovered_asset',
      targetId: 'da_pending_1',
      outcome: 'SUCCESS',
      affectedResources: [{ kind: 'asset_group', id: 'ag_corp_public' }],
    }),
    buildEntry({
      id: 'audit_007',
      offsetSeconds: -18000,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'asset.reject',
      targetKind: 'discovered_asset',
      targetId: 'da_out_of_scope_1',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_008',
      offsetSeconds: -21600,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'asset_scope.update',
      targetKind: 'asset_group',
      targetId: 'ag_corp_internal',
      outcome: 'SUCCESS',
      requestPayload: { added: ['10.0.1.0/24'] },
    }),
    buildEntry({
      id: 'audit_009',
      offsetSeconds: -25200,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'config.update',
      targetKind: 'tool_config',
      targetId: 'nuclei',
      outcome: 'SUCCESS',
      requestPayload: { changedKeys: ['intensities.HIGH.concurrency'] },
    }),
    buildEntry({
      id: 'audit_010',
      offsetSeconds: -28800,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'kill_switch.operate',
      targetKind: 'kill_switch',
      targetId: 'global',
      outcome: 'SUCCESS',
      requestPayload: { target: 'STOPPED', confirm: 'CONFIRM' },
      note: 'Kill switch triggered from operator console.',
    }),
    buildEntry({
      id: 'audit_011',
      offsetSeconds: -32400,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'weak_password.view',
      targetKind: 'task',
      targetId: 'task_partial_demo',
      outcome: 'SUCCESS',
      // Mask-by-contract: stored value is the literal redaction marker.
      clearTextPassword: '[redacted]',
      note: '弱口令明文窗口期内查看；明文不写入审计日志。',
    }),
    buildEntry({
      id: 'audit_012',
      offsetSeconds: -36000,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'weak_password.export',
      targetKind: 'task',
      targetId: 'task_partial_demo',
      outcome: 'SUCCESS',
      clearTextPassword: '[redacted]',
      note: 'XLSX 导出，加密密码仅向用户展示一次。',
    }),
    buildEntry({
      id: 'audit_013',
      offsetSeconds: -39600,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'report.export',
      targetKind: 'report',
      targetId: 'report_001',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_014',
      offsetSeconds: -43200,
      actorId: 'actor_audit',
      roleIds: ['auditor'],
      action: 'audit_log.view',
      targetKind: 'audit',
      targetId: 'global',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_015',
      offsetSeconds: -46800,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'log_source.update',
      targetKind: 'log_source',
      targetId: 'logsrc_firewall_main',
      outcome: 'SUCCESS',
      requestPayload: { changedKeys: ['eventRetentionDays'] },
      rawLogBody: 'unavailable',
    }),
    buildEntry({
      id: 'audit_016',
      offsetSeconds: -50400,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'mail_source.update',
      targetKind: 'mail_source',
      targetId: 'mailsrc_main',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_017',
      offsetSeconds: -54000,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'llm_provider.update',
      targetKind: 'llm_provider',
      targetId: 'llm_openai_compat',
      outcome: 'SUCCESS',
      requestPayload: { changedKeys: ['baseUrl', 'apiKey'] },
    }),
    buildEntry({
      id: 'audit_018',
      offsetSeconds: -57600,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'tool_config.update',
      targetKind: 'tool_config',
      targetId: 'hydra',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_019',
      offsetSeconds: -86400,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'task.execute',
      targetKind: 'task',
      targetId: 'task_partial_demo',
      outcome: 'FAILURE',
      validationResult: { reason: 'TOOL_TIMEOUT', tool: 'nuclei' },
    }),
    buildEntry({
      id: 'audit_020',
      offsetSeconds: -90000,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'task.create',
      targetKind: 'task',
      targetId: 'task_clarification_demo',
      outcome: 'SUCCESS',
      validationResult: { needsClarification: true },
    }),
    buildEntry({
      id: 'audit_021',
      offsetSeconds: -100000,
      actorId: 'actor_audit',
      roleIds: ['auditor'],
      action: 'audit_log.view',
      targetKind: 'audit',
      targetId: 'global',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_022',
      offsetSeconds: -120000,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'task.create',
      targetKind: 'task',
      targetId: 'task_old_001',
      outcome: 'BLOCKED',
      validationResult: { reason: 'AUTHORIZATION_DENIED' },
    }),
    buildEntry({
      id: 'audit_023',
      offsetSeconds: -150000,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'config.update',
      targetKind: 'tool_config',
      targetId: 'nmap',
      outcome: 'SUCCESS',
    }),
    buildEntry({
      id: 'audit_024',
      offsetSeconds: -180000,
      actorId: 'actor_root',
      roleIds: ['admin'],
      action: 'kill_switch.operate',
      targetKind: 'kill_switch',
      targetId: 'global',
      outcome: 'FAILURE',
      validationResult: { reason: 'INVALID_CONFIRM_TOKEN' },
      note: 'Operator typed wrong CONFIRM token.',
    }),
    buildEntry({
      id: 'audit_025',
      offsetSeconds: -210000,
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'report.export',
      targetKind: 'report',
      targetId: 'report_002',
      outcome: 'SUCCESS',
    }),
  ];

  return new Map(entries.map((entry) => [entry.auditLogEntryId, entry]));
}

// ---------------------------------------------------------------------------
// LLM Providers — 2 entries.
// ---------------------------------------------------------------------------

export function seedLlmProviders(): Map<string, LlmProvider> {
  const map = new Map<string, LlmProvider>();
  map.set('llm_openai_compat', {
    llmProviderId: 'llm_openai_compat',
    name: '内网 OpenAI 兼容网关',
    type: 'openai-compatible',
    status: 'ENABLED',
    baseUrl: 'https://llm-gw.internal/v1',
    purposes: ['intent-recognition', 'plan-generation', 'explanation', 'report-draft'],
    apiKeyMask: '••••',
    lastModifiedBy: 'actor_root',
    lastModifiedAt: nowIso(-54000),
  });
  map.set('llm_local_ollama', {
    llmProviderId: 'llm_local_ollama',
    name: '本地 Ollama（备用）',
    type: 'local',
    status: 'DISABLED',
    baseUrl: 'http://localhost:11434',
    purposes: ['explanation'],
    apiKeyMask: null,
    lastModifiedBy: 'actor_root',
    lastModifiedAt: nowIso(-86400),
  });
  return map;
}

// ---------------------------------------------------------------------------
// Tool configs — all 7 tools with low/medium/high profiles.
// ---------------------------------------------------------------------------

export function seedToolConfigs(): Map<string, ToolConfig> {
  const map = new Map<string, ToolConfig>();
  const baseEntry = (
    tool: ToolConfig['tool'],
    notes: { LOW: string; MEDIUM: string; HIGH: string },
  ): ToolConfig => ({
    tool,
    version: '1.0.0',
    path: `/usr/local/bin/${tool}`,
    intensities: {
      LOW: { concurrency: 5, rateLimitPerSecond: 5, timeoutSeconds: 60, notes: notes.LOW },
      MEDIUM: { concurrency: 10, rateLimitPerSecond: 20, timeoutSeconds: 180, notes: notes.MEDIUM },
      HIGH: { concurrency: 25, rateLimitPerSecond: 50, timeoutSeconds: 600, notes: notes.HIGH },
    },
    lastModifiedBy: 'actor_root',
    lastModifiedAt: nowIso(-25200),
  });

  map.set('subfinder', baseEntry('subfinder', {
    LOW: '默认子域源',
    MEDIUM: '扩展子域源',
    HIGH: '全部子域源 + 主动 DNS',
  }));
  map.set('httpx', baseEntry('httpx', {
    LOW: '存活探测',
    MEDIUM: '存活 + 标题 + 状态码',
    HIGH: '存活 + 全量指纹',
  }));
  map.set('nmap', baseEntry('nmap', {
    LOW: '前 100 端口',
    MEDIUM: '前 1000 端口',
    HIGH: '全端口 + 服务识别',
  }));
  map.set('nuclei', baseEntry('nuclei', {
    LOW: 'critical/high 模板',
    MEDIUM: '默认模板集',
    HIGH: '全模板集（需二次确认）',
  }));
  map.set('hydra', baseEntry('hydra', {
    LOW: '小字典 + 低并发',
    MEDIUM: '中字典 + 标准并发',
    HIGH: '全字典 + 高并发（需二次确认）',
  }));
  map.set('emlAnalyzer', baseEntry('emlAnalyzer', {
    LOW: '基础结构解析',
    MEDIUM: '完整 Header / IOC',
    HIGH: '完整 Header / IOC / 附件递归',
  }));
  map.set('magika', baseEntry('magika', {
    LOW: '常见 MIME',
    MEDIUM: '扩展 MIME',
    HIGH: '完整 MIME + 二进制检查',
  }));
  return map;
}

// ---------------------------------------------------------------------------
// Log sources — firewall TLS-syslog + web HTTP-push.
// ---------------------------------------------------------------------------

export function seedLogSources(): Map<string, LogSource> {
  const map = new Map<string, LogSource>();
  map.set('logsrc_firewall_main', {
    logSourceId: 'logsrc_firewall_main',
    name: '边界防火墙日志（TLS Syslog）',
    logKind: 'firewall',
    productType: 'generic-firewall',
    protocol: 'tls-syslog',
    parserFormat: 'syslog',
    assetGroupId: 'ag_corp_public',
    status: 'ENABLED',
    health: 'HEALTHY',
    listenAddress: '0.0.0.0',
    listenPort: 6514,
    tlsConfigPlaceholder: 'configured',
    allowedSourceIps: ['203.0.113.0/24'],
    eventRetentionDays: 180,
    metricsRetentionDays: 365,
    lastModifiedBy: 'actor_root',
    lastModifiedAt: nowIso(-46800),
  });
  map.set('logsrc_web_main', {
    logSourceId: 'logsrc_web_main',
    name: 'Web 反代访问日志（HTTP push）',
    logKind: 'web',
    productType: 'nginx',
    protocol: 'http-push',
    parserFormat: 'nginx-access',
    assetGroupId: 'ag_corp_public',
    status: 'ENABLED',
    health: 'HEALTHY',
    listenAddress: '0.0.0.0',
    listenPort: 8443,
    tlsConfigPlaceholder: 'configured',
    allowedSourceIps: ['10.0.0.0/16'],
    eventRetentionDays: 180,
    metricsRetentionDays: 365,
    lastModifiedBy: 'actor_root',
    lastModifiedAt: nowIso(-90000),
  });
  return map;
}

// ---------------------------------------------------------------------------
// Mail sources — 1 entry.
// ---------------------------------------------------------------------------

export function seedMailSources(): Map<string, MailSource> {
  const map = new Map<string, MailSource>();
  map.set('mailsrc_main', {
    mailSourceId: 'mailsrc_main',
    name: '主邮件网关',
    upstreamHost: 'mx.upstream.example',
    upstreamPort: 25,
    downstreamHost: 'corp-mail.internal',
    downstreamPort: 25,
    status: 'ENABLED',
    recentReceivedCount: 1820,
    tlsConfigPlaceholder: 'configured',
    maxMessageBytes: 50 * 1024 * 1024,
    failOpenPolicy: 'forward-with-marker',
    lastModifiedBy: 'actor_root',
    lastModifiedAt: nowIso(-50400),
  });
  return map;
}

// ---------------------------------------------------------------------------
// Kill switch — running by default.
// ---------------------------------------------------------------------------

export function seedKillSwitch(): KillSwitchState {
  return {
    status: 'RUNNING',
    lastOperatorActorId: 'actor_root',
    lastOperatedAt: nowIso(-86400 * 5),
    scopeNote: '停止扫描工具与受控辅助命令；不影响邮件网关与日志接收链路。',
  };
}
