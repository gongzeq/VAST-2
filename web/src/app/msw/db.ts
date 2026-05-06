/**
 * In-memory state shared by all MSW handlers. The DB is mutated by handler
 * implementations; tests can call `resetDb()` between cases to start clean.
 */
import type {
  ActorContext,
  AssetGroup,
  AssetWhitelistEntry,
  AuditLogEntry,
  DashboardSummary,
  DiscoveredAssetRecord,
  KillSwitchState,
  LlmProvider,
  LogSource,
  MailAnalysisRecord,
  MailGatewayConfig,
  MailSource,
  TaskRecord,
  ToolConfig,
  VulnerabilityScanResult,
} from '@/shared/contracts';

import {
  seedAuditLog,
  seedDashboardSummary,
  seedKillSwitch,
  seedLlmProviders,
  seedLogSources,
  seedMailSources,
  seedToolConfigs,
} from './operations-seeds';

export type MswVulnerabilityScanRecord = VulnerabilityScanResult & {
  assetGroupId: string;
};

export interface MswDb {
  actor: ActorContext | null;
  tasks: Map<string, TaskRecord>;
  assetGroups: Map<string, AssetGroup>;
  /**
   * Whitelist entries are kept on the asset-group aggregate. This map is for
   * convenience when handlers append entries.
   */
  whitelistAdditions: Map<string, AssetWhitelistEntry[]>;
  discoveredAssets: Map<string, DiscoveredAssetRecord>;
  vulnerabilityScans: Map<string, MswVulnerabilityScanRecord>;
  /**
   * Polling-demo bookkeeping: each GET on /api/tasks/:taskId for the demo
   * task increments this counter so the lifecycle stage can advance.
   */
  pollCounters: Map<string, number>;
  // --- Operations surfaces (dashboard / audit / admin) -----------------
  dashboardSummary: DashboardSummary;
  auditLogEntries: Map<string, AuditLogEntry>;
  llmProviders: Map<string, LlmProvider>;
  toolConfigs: Map<string, ToolConfig>;
  logSources: Map<string, LogSource>;
  mailSources: Map<string, MailSource>;
  killSwitch: KillSwitchState;
  mailAnalyses: Map<string, MailAnalysisRecord>;
  mailGateways: Map<string, MailGatewayConfig>;
}

function nowIso(offsetSeconds = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function seedAssetGroups(): Map<string, AssetGroup> {
  const groups = new Map<string, AssetGroup>();

  groups.set('ag_corp_internal', {
    assetGroupId: 'ag_corp_internal',
    name: '内部网段',
    description: '总部办公网与生产 VLAN',
    ownerActorIds: ['actor_admin'],
    whitelistEntries: [
      {
        kind: 'cidr',
        assetGroupId: 'ag_corp_internal',
        cidr: '10.0.0.0/16',
      },
      {
        kind: 'ip',
        assetGroupId: 'ag_corp_internal',
        ip: '10.0.0.42',
      },
    ],
    createdAt: nowIso(-3600),
  });

  groups.set('ag_corp_public', {
    assetGroupId: 'ag_corp_public',
    name: '对外资产',
    description: '面向公网的域名与边界主机',
    ownerActorIds: ['actor_admin'],
    whitelistEntries: [
      {
        kind: 'root_domain',
        assetGroupId: 'ag_corp_public',
        rootDomain: 'example.com',
        allowSubdomains: true,
      },
    ],
    createdAt: nowIso(-7200),
  });

  return groups;
}

function seedDiscoveredAssets(): Map<string, DiscoveredAssetRecord> {
  const map = new Map<string, DiscoveredAssetRecord>();

  map.set('da_pending_1', {
    discoveredAssetId: 'da_pending_1',
    assetGroupId: 'ag_corp_public',
    sourceTarget: 'example.com',
    target: { kind: 'domain', value: 'api.example.com' },
    status: 'DISCOVERED_PENDING_CONFIRMATION',
    probe: {
      url: 'https://api.example.com',
      statusCode: 200,
      title: 'API Gateway',
      technologies: ['nginx'],
    },
    discoveredAt: nowIso(-1800),
  });

  map.set('da_pending_2', {
    discoveredAssetId: 'da_pending_2',
    assetGroupId: 'ag_corp_public',
    sourceTarget: 'example.com',
    target: { kind: 'domain', value: 'beta.example.com' },
    status: 'DISCOVERED_PENDING_CONFIRMATION',
    probe: null,
    discoveredAt: nowIso(-1700),
  });

  map.set('da_out_of_scope_1', {
    discoveredAssetId: 'da_out_of_scope_1',
    assetGroupId: 'ag_corp_public',
    sourceTarget: 'example.com',
    target: { kind: 'domain', value: 'unrelated.partner.io' },
    status: 'OUT_OF_SCOPE_DISCOVERED',
    probe: null,
    discoveredAt: nowIso(-1500),
  });

  map.set('da_confirmed_1', {
    discoveredAssetId: 'da_confirmed_1',
    assetGroupId: 'ag_corp_public',
    sourceTarget: 'example.com',
    target: { kind: 'ip', value: '203.0.113.10' },
    status: 'CONFIRMED',
    probe: {
      url: 'http://203.0.113.10',
      statusCode: 200,
      title: 'Edge HTTP',
      technologies: [],
    },
    discoveredAt: nowIso(-1000),
  });

  return map;
}

function seedTasks(): Map<string, TaskRecord> {
  const tasks = new Map<string, TaskRecord>();

  tasks.set('task_running_demo', {
    taskId: 'task_running_demo',
    assetGroupId: 'ag_corp_public',
    workflowType: 'ASSET_DISCOVERY',
    requestedIntensity: 'MEDIUM',
    yoloRequested: false,
    lifecycleStage: 'AWAITING_CONFIRMATION',
    state: null,
    targets: [{ kind: 'domain', value: 'example.com' }],
    steps: [
      {
        stepId: 'step_subfinder',
        stepType: 'subfinder',
        description: '枚举 example.com 子域名',
        targetRefs: ['example.com'],
        dependsOnStepIds: [],
        requiresConfirmation: false,
        executionStatus: 'PENDING',
      },
      {
        stepId: 'step_httpx',
        stepType: 'httpx',
        description: '对发现的子域名做存活探测',
        targetRefs: [],
        dependsOnStepIds: ['step_subfinder'],
        requiresConfirmation: false,
        executionStatus: 'PENDING',
      },
    ],
    clarifications: [],
    confirmations: [],
    createdAt: nowIso(-600),
    updatedAt: nowIso(-300),
  });

  tasks.set('task_blocked_demo', {
    taskId: 'task_blocked_demo',
    assetGroupId: null,
    workflowType: 'VULNERABILITY_SCAN',
    requestedIntensity: 'HIGH',
    yoloRequested: false,
    lifecycleStage: 'FINISHED',
    state: 'BLOCKED',
    targets: [{ kind: 'domain', value: 'unauthorized.example.org' }],
    steps: [
      {
        stepId: 'step_authz',
        stepType: 'authorization',
        description: '目标 unauthorized.example.org 不在任何资产组白名单内',
        targetRefs: ['unauthorized.example.org'],
        dependsOnStepIds: [],
        requiresConfirmation: false,
        executionStatus: 'FAILED',
      },
    ],
    clarifications: [],
    confirmations: [],
    createdAt: nowIso(-7200),
    updatedAt: nowIso(-7100),
  });

  tasks.set('task_partial_demo', {
    taskId: 'task_partial_demo',
    assetGroupId: 'ag_corp_internal',
    workflowType: 'COMPREHENSIVE_SCAN',
    requestedIntensity: 'MEDIUM',
    yoloRequested: false,
    lifecycleStage: 'FINISHED',
    state: 'PARTIAL_SUCCESS',
    targets: [{ kind: 'ip', value: '10.0.0.42' }],
    steps: [
      {
        stepId: 'step_nmap',
        stepType: 'nmap',
        description: '端口识别',
        targetRefs: ['10.0.0.42'],
        dependsOnStepIds: [],
        requiresConfirmation: false,
        executionStatus: 'SUCCESS',
      },
      {
        stepId: 'step_nuclei',
        stepType: 'nuclei',
        description: '漏洞扫描',
        targetRefs: ['10.0.0.42'],
        dependsOnStepIds: ['step_nmap'],
        requiresConfirmation: false,
        executionStatus: 'FAILED',
      },
    ],
    clarifications: [],
    confirmations: [],
    createdAt: nowIso(-14400),
    updatedAt: nowIso(-14000),
  });

  tasks.set('task_clarification_demo', {
    taskId: 'task_clarification_demo',
    assetGroupId: null,
    workflowType: 'WEAK_PASSWORD_SCAN',
    requestedIntensity: 'LOW',
    yoloRequested: false,
    lifecycleStage: 'AWAITING_CLARIFICATION',
    state: 'NEEDS_CLARIFICATION',
    targets: [],
    steps: [],
    clarifications: [
      {
        clarificationId: 'cl_target',
        question: '请指定要扫描的资产组或目标 IP 段',
        answer: null,
        createdAt: nowIso(-100),
        answeredAt: null,
      },
    ],
    confirmations: [],
    createdAt: nowIso(-150),
    updatedAt: nowIso(-100),
  });

  return tasks;
}

function seedVulnerabilityScans(): Map<string, MswVulnerabilityScanRecord> {
  const scans = new Map<string, MswVulnerabilityScanRecord>();

  scans.set('scan_internal_apache_partial', {
    scanId: 'scan_internal_apache_partial',
    taskId: 'task_partial_demo',
    assetGroupId: 'ag_corp_internal',
    status: 'PARTIAL_SUCCESS',
    startedAt: nowIso(-10800),
    completedAt: nowIso(-10500),
    targetsScanned: 5,
    findings: [
      {
        findingId: 'finding_apache_10_0_0_42',
        vulnerabilityId: 'vuln_cve_2021_41773',
        title: 'Apache Path Traversal / RCE',
        description: 'Apache HTTP Server 2.4.49 path traversal exposure on reachable internal hosts.',
        severity: 'CRITICAL',
        cvssScore: 9.8,
        cveReferences: [{ cveId: 'CVE-2021-41773' }],
        affectedAsset: '10.0.0.42',
        port: 80,
        service: 'http',
        evidence: 'GET /cgi-bin/.%2e/.%2e/.%2e/.%2e/bin/sh returned command execution marker.',
        remediation: 'Upgrade Apache HTTP Server to a fixed version and disable vulnerable CGI exposure.',
        status: 'OPEN',
        discoveredAt: nowIso(-10400),
        verifiedAt: nowIso(-10300),
      },
      {
        findingId: 'finding_apache_10_0_0_43',
        vulnerabilityId: 'vuln_cve_2021_41773',
        title: 'Apache Path Traversal / RCE',
        description: 'Apache HTTP Server 2.4.49 path traversal exposure on reachable internal hosts.',
        severity: 'CRITICAL',
        cvssScore: 9.8,
        cveReferences: [{ cveId: 'CVE-2021-41773' }],
        affectedAsset: '10.0.0.43',
        port: 8080,
        service: 'http-alt',
        evidence: 'Traversal probe returned /etc/passwd signature.',
        remediation: 'Upgrade Apache HTTP Server to a fixed version and remove traversal alias mappings.',
        status: 'OPEN',
        discoveredAt: nowIso(-10350),
        verifiedAt: nowIso(-10290),
      },
      {
        findingId: 'finding_apache_10_0_0_44',
        vulnerabilityId: 'vuln_cve_2021_41773',
        title: 'Apache Path Traversal / RCE',
        description: 'Apache HTTP Server 2.4.49 path traversal exposure on reachable internal hosts.',
        severity: 'CRITICAL',
        cvssScore: 9.8,
        cveReferences: [{ cveId: 'CVE-2021-41773' }],
        affectedAsset: '10.0.0.44',
        port: 80,
        service: 'http',
        evidence: 'Traversal probe confirmed alias bypass.',
        remediation: null,
        status: 'MITIGATED',
        discoveredAt: nowIso(-10300),
        verifiedAt: nowIso(-10100),
      },
      {
        findingId: 'finding_apache_10_0_0_45',
        vulnerabilityId: 'vuln_cve_2021_41773',
        title: 'Apache Path Traversal / RCE',
        description: 'Apache HTTP Server 2.4.49 path traversal exposure on reachable internal hosts.',
        severity: 'CRITICAL',
        cvssScore: 9.8,
        cveReferences: [{ cveId: 'CVE-2021-41773' }],
        affectedAsset: '10.0.0.45',
        port: 443,
        service: 'https',
        evidence: 'Encoded traversal reached protected filesystem path.',
        remediation: 'Patch Apache and validate all Alias directives.',
        status: 'CONFIRMED',
        discoveredAt: nowIso(-10250),
        verifiedAt: nowIso(-10120),
      },
      {
        findingId: 'finding_apache_10_0_0_46',
        vulnerabilityId: 'vuln_cve_2021_41773',
        title: 'Apache Path Traversal / RCE',
        description: 'Apache HTTP Server 2.4.49 path traversal exposure on reachable internal hosts.',
        severity: 'CRITICAL',
        cvssScore: 9.8,
        cveReferences: [{ cveId: 'CVE-2021-41773' }],
        affectedAsset: '10.0.0.46',
        port: 8443,
        service: 'https-alt',
        evidence: 'Traversal payload produced expected vulnerable response body.',
        remediation: 'Patch Apache and restrict CGI endpoints.',
        status: 'OPEN',
        discoveredAt: nowIso(-10200),
        verifiedAt: null,
      },
    ],
    errors: [{ target: '10.0.0.47', error: 'scanner timeout' }],
  });

  scans.set('scan_public_tls_success', {
    scanId: 'scan_public_tls_success',
    taskId: 'task_running_demo',
    assetGroupId: 'ag_corp_public',
    status: 'SUCCESS',
    startedAt: nowIso(-7200),
    completedAt: nowIso(-7000),
    targetsScanned: 2,
    findings: [
      {
        findingId: 'finding_tls_api_example',
        vulnerabilityId: 'vuln_tls_weak_cipher',
        title: 'TLS weak cipher suite enabled',
        description: 'Public HTTPS endpoint accepts legacy cipher suites.',
        severity: 'HIGH',
        cvssScore: 7.4,
        cveReferences: [],
        affectedAsset: 'api.example.com',
        port: 443,
        service: 'https',
        evidence: 'TLS probe negotiated TLS_RSA_WITH_3DES_EDE_CBC_SHA.',
        remediation: 'Disable legacy TLS cipher suites and enforce modern TLS policy.',
        status: 'OPEN',
        discoveredAt: nowIso(-6980),
        verifiedAt: nowIso(-6900),
      },
    ],
    errors: [],
  });

  scans.set('scan_public_info_success', {
    scanId: 'scan_public_info_success',
    taskId: 'task_running_demo',
    assetGroupId: 'ag_corp_public',
    status: 'SUCCESS',
    startedAt: nowIso(-5400),
    completedAt: nowIso(-5200),
    targetsScanned: 1,
    findings: [
      {
        findingId: 'finding_nginx_version_beta',
        vulnerabilityId: 'vuln_nginx_version_disclosure',
        title: 'Server version disclosure',
        description: 'HTTP response headers expose server version metadata.',
        severity: 'LOW',
        cvssScore: null,
        cveReferences: [],
        affectedAsset: 'beta.example.com',
        port: 80,
        service: 'http',
        evidence: 'Server: nginx/1.18.0 header observed.',
        remediation: 'Disable server tokens in the web server configuration.',
        status: 'ACCEPTED_RISK',
        discoveredAt: nowIso(-5180),
        verifiedAt: null,
      },
    ],
    errors: [],
  });

  return scans;
}

let dbInstance: MswDb;

function seedMailGateways(): Map<string, MailGatewayConfig> {
  const gateways = new Map<string, MailGatewayConfig>();
  gateways.set('mgw_corp_primary', {
    gatewayId: 'mgw_corp_primary',
    assetGroupId: 'ag_corp_public',
    inboundSourceRefs: ['inbound-mx-1.example.com'],
    downstreamHost: 'mx.corp.internal',
    downstreamPort: 25,
    enabled: true,
  });
  gateways.set('mgw_corp_secondary', {
    gatewayId: 'mgw_corp_secondary',
    assetGroupId: 'ag_corp_internal',
    inboundSourceRefs: ['inbound-mx-2.example.com'],
    downstreamHost: 'mx2.corp.internal',
    downstreamPort: 25,
    enabled: true,
  });
  return gateways;
}

function seedMailAnalyses(): Map<string, MailAnalysisRecord> {
  const records = new Map<string, MailAnalysisRecord>();

  records.set('mail_suspected_demo', {
    mailTaskId: 'mail_suspected_demo',
    gatewayId: 'mgw_corp_primary',
    assetGroupId: 'ag_corp_public',
    sourceRef: 'msg-uid-001',
    receivedAt: nowIso(-3600),
    subject: '【紧急】您的账户即将被冻结，请立即验证',
    from: 'security-alerts@corp-secure-login.io',
    recipients: ['alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@example.com'],
    messageSizeBytes: 28_400,
    bodySha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    rawBodyStored: false,
    analysisMode: 'FULL',
    analysisStatus: 'ANALYZED',
    phishingLabel: 'suspected',
    riskScore: 92,
    securityHeaders: {
      'X-Security-Phishing': 'suspected',
      'X-Security-Risk-Score': '92',
      'X-Security-Task-ID': 'mail_suspected_demo',
      'X-Security-Analysis': 'ok',
      'X-Original-Sender': 'security-alerts@corp-secure-login.io',
    },
    attachmentAnalyses: [
      {
        filename: 'invoice.pdf.exe',
        sizeBytes: 18_240,
        contentType: 'application/octet-stream',
        sha256: 'f1' + '0'.repeat(62),
        analyzed: true,
        skippedReason: null,
        fileType: 'PE32 executable',
        riskSignals: ['executable-disguised-as-pdf'],
      },
    ],
    iocs: [
      { kind: 'URL', value: 'https://corp-secure-login.io/verify' },
      { kind: 'DOMAIN', value: 'corp-secure-login.io' },
      { kind: 'IP', value: '203.0.113.55' },
      { kind: 'EMAIL', value: 'security-alerts@corp-secure-login.io' },
    ],
    forwardingResult: {
      status: 'FORWARDED',
      downstreamHost: 'mx.corp.internal',
      downstreamPort: 25,
      forwardedAt: nowIso(-3590),
      appliedHeaders: {
        'X-Security-Phishing': 'suspected',
        'X-Security-Risk-Score': '92',
        'X-Security-Task-ID': 'mail_suspected_demo',
        'X-Security-Analysis': 'ok',
      },
    },
    riskSignals: ['spf:fail', 'dkim:fail', 'urgency-language', 'lookalike-domain'],
    unavailableReason: null,
  });

  records.set('mail_clean_demo', {
    mailTaskId: 'mail_clean_demo',
    gatewayId: 'mgw_corp_primary',
    assetGroupId: 'ag_corp_public',
    sourceRef: 'msg-uid-002',
    receivedAt: nowIso(-7200),
    subject: 'Q3 Engineering all-hands recap',
    from: 'eng-comms@example.com',
    recipients: ['alice@example.com'],
    messageSizeBytes: 12_400,
    bodySha256: 'b2'.repeat(32),
    rawBodyStored: false,
    analysisMode: 'FULL',
    analysisStatus: 'ANALYZED',
    phishingLabel: 'clean',
    riskScore: 8,
    securityHeaders: {
      'X-Security-Phishing': 'clean',
      'X-Security-Risk-Score': '8',
      'X-Security-Task-ID': 'mail_clean_demo',
      'X-Security-Analysis': 'ok',
    },
    attachmentAnalyses: [],
    iocs: [],
    forwardingResult: {
      status: 'FORWARDED',
      downstreamHost: 'mx.corp.internal',
      downstreamPort: 25,
      forwardedAt: nowIso(-7195),
      appliedHeaders: {
        'X-Security-Phishing': 'clean',
        'X-Security-Risk-Score': '8',
        'X-Security-Task-ID': 'mail_clean_demo',
        'X-Security-Analysis': 'ok',
      },
    },
    riskSignals: [],
    unavailableReason: null,
  });

  records.set('mail_suspicious_demo', {
    mailTaskId: 'mail_suspicious_demo',
    gatewayId: 'mgw_corp_secondary',
    assetGroupId: 'ag_corp_internal',
    sourceRef: 'msg-uid-003',
    receivedAt: nowIso(-1800),
    subject: 'Re: Project handoff documents',
    from: 'pmgr@example-vendor.com',
    recipients: ['eng-team@example.com'],
    messageSizeBytes: 60_000,
    bodySha256: 'c3'.repeat(32),
    rawBodyStored: false,
    analysisMode: 'FULL',
    analysisStatus: 'ANALYZED',
    phishingLabel: 'suspicious',
    riskScore: 65,
    securityHeaders: {
      'X-Security-Phishing': 'suspicious',
      'X-Security-Risk-Score': '65',
      'X-Security-Task-ID': 'mail_suspicious_demo',
      'X-Security-Analysis': 'ok',
    },
    attachmentAnalyses: [
      {
        filename: 'handoff.xlsx',
        sizeBytes: 35_000,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sha256: 'd4'.repeat(32),
        analyzed: true,
        skippedReason: null,
        fileType: 'Office OOXML',
        riskSignals: ['macro-present'],
      },
    ],
    iocs: [{ kind: 'DOMAIN', value: 'example-vendor.com' }],
    forwardingResult: {
      status: 'FORWARDED',
      downstreamHost: 'mx2.corp.internal',
      downstreamPort: 25,
      forwardedAt: nowIso(-1795),
      appliedHeaders: {
        'X-Security-Phishing': 'suspicious',
        'X-Security-Risk-Score': '65',
        'X-Security-Task-ID': 'mail_suspicious_demo',
        'X-Security-Analysis': 'ok',
      },
    },
    riskSignals: ['unusual-attachment', 'spf:softfail'],
    unavailableReason: null,
  });

  records.set('mail_oversize_demo', {
    mailTaskId: 'mail_oversize_demo',
    gatewayId: 'mgw_corp_primary',
    assetGroupId: 'ag_corp_public',
    sourceRef: 'msg-uid-004',
    receivedAt: nowIso(-900),
    subject: 'Customer reference photos (large)',
    from: 'partner@example-partner.io',
    recipients: ['marketing@example.com'],
    messageSizeBytes: 65 * 1024 * 1024,
    bodySha256: 'e5'.repeat(32),
    rawBodyStored: false,
    analysisMode: 'BODY_ONLY_SIZE_LIMIT',
    analysisStatus: 'ANALYZED',
    phishingLabel: 'clean',
    riskScore: 12,
    securityHeaders: {
      'X-Security-Phishing': 'clean',
      'X-Security-Risk-Score': '12',
      'X-Security-Task-ID': 'mail_oversize_demo',
      'X-Security-Analysis': 'body-only-size-limit',
    },
    attachmentAnalyses: [
      {
        filename: 'photos-bundle.zip',
        sizeBytes: 60 * 1024 * 1024,
        contentType: 'application/zip',
        sha256: 'f6'.repeat(32),
        analyzed: false,
        skippedReason: '邮件超 50MB 上限，附件未分析',
        fileType: null,
        riskSignals: [],
      },
    ],
    iocs: [],
    forwardingResult: {
      status: 'FORWARDED',
      downstreamHost: 'mx.corp.internal',
      downstreamPort: 25,
      forwardedAt: nowIso(-895),
      appliedHeaders: {
        'X-Security-Phishing': 'clean',
        'X-Security-Risk-Score': '12',
        'X-Security-Task-ID': 'mail_oversize_demo',
        'X-Security-Analysis': 'body-only-size-limit',
      },
    },
    riskSignals: [],
    unavailableReason: null,
  });

  records.set('mail_unavailable_demo', {
    mailTaskId: 'mail_unavailable_demo',
    gatewayId: 'mgw_corp_primary',
    assetGroupId: 'ag_corp_public',
    sourceRef: 'msg-uid-005',
    receivedAt: nowIso(-300),
    subject: null,
    from: null,
    recipients: ['ops@example.com'],
    messageSizeBytes: 8_400,
    bodySha256: 'a7'.repeat(32),
    rawBodyStored: false,
    analysisMode: 'UNAVAILABLE',
    analysisStatus: 'UNAVAILABLE',
    phishingLabel: null,
    riskScore: null,
    securityHeaders: {
      'X-Security-Task-ID': 'mail_unavailable_demo',
      'X-Security-Analysis': 'unavailable',
    },
    attachmentAnalyses: [],
    iocs: [],
    forwardingResult: {
      status: 'FORWARDED',
      downstreamHost: 'mx.corp.internal',
      downstreamPort: 25,
      forwardedAt: nowIso(-295),
      appliedHeaders: {
        'X-Security-Task-ID': 'mail_unavailable_demo',
        'X-Security-Analysis': 'unavailable',
      },
    },
    riskSignals: [],
    unavailableReason: '分析服务暂时不可达；邮件按 fail-open 策略已转发。',
  });

  // Spread out a few more clean records to exercise pagination.
  for (let i = 0; i < 5; i += 1) {
    const id = `mail_filler_${i}`;
    records.set(id, {
      mailTaskId: id,
      gatewayId: 'mgw_corp_primary',
      assetGroupId: 'ag_corp_public',
      sourceRef: `msg-filler-${i}`,
      receivedAt: nowIso(-86400 - i * 600),
      subject: `Newsletter ${i + 1}`,
      from: 'news@example.com',
      recipients: ['alice@example.com'],
      messageSizeBytes: 4_000 + i * 200,
      bodySha256: ('aa' + i.toString(16).padStart(2, '0')).repeat(16),
      rawBodyStored: false,
      analysisMode: 'FULL',
      analysisStatus: 'ANALYZED',
      phishingLabel: 'clean',
      riskScore: 5,
      securityHeaders: {
        'X-Security-Phishing': 'clean',
        'X-Security-Risk-Score': '5',
        'X-Security-Task-ID': id,
        'X-Security-Analysis': 'ok',
      },
      attachmentAnalyses: [],
      iocs: [],
      forwardingResult: {
        status: 'FORWARDED',
        downstreamHost: 'mx.corp.internal',
        downstreamPort: 25,
        forwardedAt: nowIso(-86395 - i * 600),
        appliedHeaders: {
          'X-Security-Phishing': 'clean',
          'X-Security-Risk-Score': '5',
          'X-Security-Task-ID': id,
          'X-Security-Analysis': 'ok',
        },
      },
      riskSignals: [],
      unavailableReason: null,
    });
  }

  return records;
}

export function buildFreshDb(): MswDb {
  return {
    actor: null,
    tasks: seedTasks(),
    assetGroups: seedAssetGroups(),
    whitelistAdditions: new Map(),
    discoveredAssets: seedDiscoveredAssets(),
    vulnerabilityScans: seedVulnerabilityScans(),
    pollCounters: new Map(),
    dashboardSummary: seedDashboardSummary(),
    auditLogEntries: seedAuditLog(),
    llmProviders: seedLlmProviders(),
    toolConfigs: seedToolConfigs(),
    logSources: seedLogSources(),
    mailSources: seedMailSources(),
    killSwitch: seedKillSwitch(),
    mailAnalyses: seedMailAnalyses(),
    mailGateways: seedMailGateways(),
  };
}

dbInstance = buildFreshDb();

export function db(): MswDb {
  return dbInstance;
}

export function resetDb(): void {
  dbInstance = buildFreshDb();
}
