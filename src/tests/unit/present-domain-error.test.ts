import { describe, expect, it } from 'vitest';

import { presentDomainError } from '../../app/http/present-domain-error.js';
import { AssetScopeBlockedError } from '../../shared/contracts/foundation.js';

describe('presentDomainError', () => {
  it('maps domain errors to stable API-safe responses', () => {
    const response = presentDomainError(
      new AssetScopeBlockedError({
        asset_group_id: 'ag_prod',
        target_ref: 'example.org',
      }),
      'req_123',
    );

    expect(response).toEqual({
      error_code: 'ASSET_SCOPE_BLOCKED',
      message: 'Target is outside the authorized asset scope.',
      task_state: 'BLOCKED',
      details: {
        asset_group_id: 'ag_prod',
        target_ref: 'example.org',
      },
      request_id: 'req_123',
    });
  });
});
