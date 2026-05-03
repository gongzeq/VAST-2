import { describe, expect, it } from 'vitest';

import { type AssetWhitelistEntry } from '../../modules/asset-scope/contracts/asset-authorization.contract.js';
import { AssetDiscoveryService } from '../../modules/asset-scope/domain/asset-discovery.service.js';
import { AssetScopeService } from '../../modules/asset-scope/domain/asset-scope-service.js';
import { ServiceDiscoveryService } from '../../modules/asset-scope/domain/service-discovery.service.js';
import { type ActorContext } from '../../modules/auth/contracts/actor-context.contract.js';
import {
  MockExecutionRuntime,
  ToolRunnerService,
} from '../../modules/tool-runner/domain/tool-runner.service.js';
import {
  type ToolConfig,
  type ToolVersion,
} from '../../modules/tool-runner/contracts/tool-execution.contract.js';

const actor: ActorContext = {
  actorId: 'user_1',
  roleIds: ['security_engineer'],
  permissionPoints: ['task:create'],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: false,
};

const whitelistEntries: AssetWhitelistEntry[] = [
  {
    kind: 'root_domain',
    assetGroupId: 'ag_prod',
    rootDomain: 'example.com',
    allowSubdomains: true,
  },
];

const enumerationToolVersion: ToolVersion = {
  toolName: 'subfinder',
  version: '2.6.0',
};

const probeToolVersion: ToolVersion = {
  toolName: 'httpx',
  version: '1.6.0',
};

const serviceToolVersion: ToolVersion = {
  toolName: 'nmap',
  version: '7.95',
};

const enumerationToolConfig: ToolConfig = {
  toolType: 'SUBDOMAIN_ENUMERATION',
  toolName: 'subfinder',
  baseCommand: ['subfinder'],
  allowedParameters: [],
  intensityMappings: {
    LOW: {},
    MEDIUM: {},
    HIGH: {},
  },
  timeoutSeconds: 300,
  maxConcurrency: 1,
};

const probeToolConfig: ToolConfig = {
  toolType: 'HTTP_PROBE',
  toolName: 'httpx',
  baseCommand: ['httpx'],
  allowedParameters: [],
  intensityMappings: {
    LOW: {},
    MEDIUM: {},
    HIGH: {},
  },
  timeoutSeconds: 300,
  maxConcurrency: 1,
};

const serviceDetectionToolConfig: ToolConfig = {
  toolType: 'SERVICE_DETECTION',
  toolName: 'nmap',
  baseCommand: ['nmap'],
  allowedParameters: [
    {
      name: 'port_range',
      flag: '-p',
      valueType: 'string',
      required: false,
    },
  ],
  intensityMappings: {
    LOW: {},
    MEDIUM: {},
    HIGH: {},
  },
  timeoutSeconds: 300,
  maxConcurrency: 1,
};

describe('Asset discovery workflows', () => {
  it('keeps out-of-scope discoveries pending outside scope and probes only authorized discoveries', async () => {
    const runtime = new MockExecutionRuntime();
    runtime.setMockResponse('subfinder example.com', {
      exitCode: 0,
      stdout: JSON.stringify([
        { subdomain: 'app.example.com' },
        { subdomain: 'evil.org' },
      ]),
      stderr: '',
    });
    runtime.setMockResponse('httpx app.example.com', {
      exitCode: 0,
      stdout: JSON.stringify([
        {
          host: 'app.example.com',
          url: 'https://app.example.com',
          status_code: 200,
          title: 'App',
          technologies: ['nginx'],
        },
      ]),
      stderr: '',
    });

    const toolRunner = new ToolRunnerService({ runtime });
    toolRunner.registerToolConfig(enumerationToolConfig);
    toolRunner.registerToolConfig(probeToolConfig);

    const service = new AssetDiscoveryService({
      toolRunner,
      assetScope: new AssetScopeService(),
    });

    const result = await service.discover(
      {
        taskId: 'task_1',
        assetGroupId: 'ag_prod',
        targets: ['example.com'],
        intensity: 'LOW',
      },
      actor,
      whitelistEntries,
      {
        enumeration: enumerationToolVersion,
        probe: probeToolVersion,
      },
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.targetsScanned).toBe(1);
    expect(result.discoveries).toHaveLength(2);
    expect(result.discoveries.map((discovery) => discovery.status).sort()).toEqual([
      'DISCOVERED_PENDING_CONFIRMATION',
      'OUT_OF_SCOPE_DISCOVERED',
    ]);
    expect(result.discoveries.find((discovery) => discovery.target.value === 'app.example.com')?.probe?.statusCode).toBe(200);
    expect(result.discoveries.find((discovery) => discovery.target.value === 'evil.org')?.probe).toBeNull();
    expect(toolRunner.auditLog.listAll().filter((record) => record.action === 'TOOL_EXECUTION_STARTED')).toHaveLength(2);
  });

  it('returns PARTIAL_SUCCESS and preserves services when one service-discovery target fails', async () => {
    const runtime = new MockExecutionRuntime();
    runtime.setMockResponse('nmap -p top-100 app.example.com', {
      exitCode: 0,
      stdout: JSON.stringify([
        {
          port: 443,
          protocol: 'tcp',
          state: 'open',
          service: 'https',
          version: 'nginx 1.26',
        },
      ]),
      stderr: '',
    });
    runtime.setMockResponse('nmap -p top-100 api.example.com', {
      exitCode: 1,
      stdout: '[]',
      stderr: 'sensitive stderr that should not leak',
    });

    const toolRunner = new ToolRunnerService({ runtime });
    toolRunner.registerToolConfig(serviceDetectionToolConfig);

    const service = new ServiceDiscoveryService({
      toolRunner,
      assetScope: new AssetScopeService(),
    });

    const result = await service.discover(
      {
        taskId: 'task_2',
        assetGroupId: 'ag_prod',
        targets: [
          { kind: 'domain', value: 'app.example.com' },
          { kind: 'domain', value: 'api.example.com' },
        ],
        intensity: 'LOW',
        portRange: 'top-100',
      },
      actor,
      whitelistEntries,
      serviceToolVersion,
    );

    expect(result.status).toBe('PARTIAL_SUCCESS');
    expect(result.targetsScanned).toBe(1);
    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.port).toBe(443);
    expect(result.errors).toEqual([
      {
        target: 'api.example.com',
        error: 'Service discovery failed for target.',
      },
    ]);
    expect(service.auditLog.listByResource(result.scanId).map((record) => record.action)).toEqual([
      'SERVICE_DISCOVERY_STARTED',
      'SERVICE_DISCOVERY_TARGET_SCANNED',
      'SERVICE_DISCOVERY_TARGET_FAILED',
      'SERVICE_DISCOVERY_COMPLETED',
    ]);
  });
});
