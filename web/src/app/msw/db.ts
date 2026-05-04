/**
 * In-memory state shared by all MSW handlers. The DB is mutated by handler
 * implementations; tests can call `resetDb()` between cases to start clean.
 */
import type {
  ActorContext,
  AssetGroup,
  AssetWhitelistEntry,
  DiscoveredAssetRecord,
  TaskRecord,
} from '@/shared/contracts';

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
  /**
   * Polling-demo bookkeeping: each GET on /api/tasks/:taskId for the demo
   * task increments this counter so the lifecycle stage can advance.
   */
  pollCounters: Map<string, number>;
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

let dbInstance: MswDb;

export function buildFreshDb(): MswDb {
  return {
    actor: null,
    tasks: seedTasks(),
    assetGroups: seedAssetGroups(),
    whitelistAdditions: new Map(),
    discoveredAssets: seedDiscoveredAssets(),
    pollCounters: new Map(),
  };
}

dbInstance = buildFreshDb();

export function db(): MswDb {
  return dbInstance;
}

export function resetDb(): void {
  dbInstance = buildFreshDb();
}
