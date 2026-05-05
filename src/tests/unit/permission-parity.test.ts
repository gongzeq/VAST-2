import { describe, expect, it } from 'vitest';
import { permissionPoints as backendPermissionPoints }
  from '../../shared/contracts/foundation.js';
import { permissionPoints as frontendPermissionPoints }
  from '../../../web/src/shared/contracts/foundation.js';

describe('permissionPoints parity', () => {
  it('backend and frontend tuples match exactly', () => {
    expect(frontendPermissionPoints).toEqual(backendPermissionPoints);
  });

  it('canonical 16-entry order is preserved', () => {
    expect(backendPermissionPoints).toEqual([
      'task:create',
      'task:confirm',
      'task:cancel',
      'task:yolo_execute',
      'asset_scope:manage',
      'audit_log:view',
      'raw_evidence:view',
      'report:export',
      'weak_password:cleartext_view',
      'weak_password:cleartext_export',
      'log_source:manage',
      'log_event:export',
      'dashboard:view',
      'llm_provider:manage',
      'tool_config:manage',
      'kill_switch:operate',
    ]);
  });
});
