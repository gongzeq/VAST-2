import { describe, expect, it } from 'vitest';

import { type AssetWhitelistEntry } from '../../modules/asset-scope/contracts/asset-authorization.contract.js';
import { type ActorContext } from '../../modules/auth/contracts/actor-context.contract.js';
import { TaskManagementService } from '../../modules/task-execution/domain/task-management.service.js';
import { TaskExecutionFailedError } from '../../shared/contracts/foundation.js';

const actor: ActorContext = {
  actorId: 'user_1',
  roleIds: ['security_engineer'],
  permissionPoints: ['task:create', 'task:confirm', 'task:cancel', 'task:yolo_execute'],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: true,
};

const whitelistEntries: AssetWhitelistEntry[] = [
  {
    kind: 'root_domain',
    assetGroupId: 'ag_prod',
    rootDomain: 'example.com',
    allowSubdomains: true,
  },
];

describe('TaskManagementService', () => {
  it('creates clarification tasks when required task fields are missing', () => {
    const service = new TaskManagementService();

    const task = service.createTask({
      actor,
      whitelistEntries,
      command: {
        workflowType: 'ASSET_DISCOVERY',
        requestedIntensity: 'LOW',
        yoloRequested: false,
        steps: [],
      },
    });

    expect(task.state).toBe('NEEDS_CLARIFICATION');
    expect(task.lifecycleStage).toBe('AWAITING_CLARIFICATION');
    expect(service.auditLog.listByResource(task.taskId)).toHaveLength(2);
  });

  it('blocks tasks that target assets outside the authorized scope', () => {
    const service = new TaskManagementService();

    const task = service.createTask({
      actor,
      whitelistEntries,
      command: {
        assetGroupId: 'ag_prod',
        workflowType: 'ASSET_DISCOVERY',
        requestedIntensity: 'LOW',
        yoloRequested: false,
        targets: [{ kind: 'domain', value: 'example.org' }],
        steps: [],
      },
    });

    expect(task.state).toBe('BLOCKED');
    expect(task.lifecycleStage).toBe('FINISHED');
    expect(() =>
      service.startTask({
        actor,
        taskId: task.taskId,
      }),
    ).toThrow(TaskExecutionFailedError);
  });

  it('requires confirmation for high intensity tasks and preserves partial success semantics', () => {
    const service = new TaskManagementService();

    const createdTask = service.createTask({
      actor,
      whitelistEntries,
      command: {
        assetGroupId: 'ag_prod',
        workflowType: 'COMPREHENSIVE_SCAN',
        requestedIntensity: 'HIGH',
        yoloRequested: true,
        highRiskConfirmed: false,
        targets: [{ kind: 'domain', value: 'a.example.com' }],
        steps: [
          {
            stepId: 'step-1',
            stepType: 'subfinder',
            description: 'discover subdomains',
            dependsOnStepIds: [],
            targetRefs: ['a.example.com'],
            requiresConfirmation: false,
          },
          {
            stepId: 'step-2',
            stepType: 'nmap',
            description: 'scan ports',
            dependsOnStepIds: ['step-1'],
            targetRefs: ['a.example.com'],
            requiresConfirmation: true,
          },
        ],
      },
    });

    expect(createdTask.lifecycleStage).toBe('AWAITING_CONFIRMATION');
    expect(createdTask.state).toBeNull();

    const confirmedTask = service.confirmTask({
      actor,
      taskId: createdTask.taskId,
      note: 'approved',
    });
    expect(confirmedTask.lifecycleStage).toBe('READY');

    const runningTask = service.startTask({
      actor,
      taskId: createdTask.taskId,
    });
    expect(runningTask.lifecycleStage).toBe('RUNNING');

    const completedTask = service.completeTask({
      actor,
      taskId: createdTask.taskId,
      stepResults: [
        {
          stepId: 'step-1',
          stepType: 'subfinder',
          description: 'discover subdomains',
          dependsOnStepIds: [],
          targetRefs: ['a.example.com'],
          requiresConfirmation: false,
          executionStatus: 'SUCCESS',
        },
        {
          stepId: 'step-2',
          stepType: 'nmap',
          description: 'scan ports',
          dependsOnStepIds: ['step-1'],
          targetRefs: ['a.example.com'],
          requiresConfirmation: true,
          executionStatus: 'FAILED',
        },
      ],
    });

    expect(completedTask.state).toBe('PARTIAL_SUCCESS');
    expect(completedTask.lifecycleStage).toBe('FINISHED');
  });
});
