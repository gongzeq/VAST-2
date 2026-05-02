import { describe, expect, it } from 'vitest';

import { AssetScopeService } from '../../modules/asset-scope/domain/asset-scope-service.js';
import { type AssetWhitelistEntry } from '../../modules/asset-scope/contracts/asset-authorization.contract.js';

describe('AssetScopeService', () => {
  const service = new AssetScopeService();
  const whitelistEntries: AssetWhitelistEntry[] = [
    {
      kind: 'root_domain',
      assetGroupId: 'ag_prod',
      rootDomain: 'example.com',
      allowSubdomains: true,
    },
    {
      kind: 'cidr',
      assetGroupId: 'ag_prod',
      cidr: '10.0.0.0/24',
    },
  ];

  it('authorizes same-root domains including any-depth subdomains', () => {
    expect(service.isTargetAuthorized('ag_prod', { kind: 'domain', value: 'example.com' }, whitelistEntries)).toBe(true);
    expect(service.isTargetAuthorized('ag_prod', { kind: 'domain', value: 'a.example.com' }, whitelistEntries)).toBe(true);
    expect(service.isTargetAuthorized('ag_prod', { kind: 'domain', value: 'b.a.example.com' }, whitelistEntries)).toBe(true);
  });

  it('rejects cross-root domains and lookalike suffixes', () => {
    expect(service.isTargetAuthorized('ag_prod', { kind: 'domain', value: 'example.org' }, whitelistEntries)).toBe(false);
    expect(service.isTargetAuthorized('ag_prod', { kind: 'domain', value: 'badexample.com' }, whitelistEntries)).toBe(false);
  });

  it('authorizes ipv4 addresses inside the configured cidr only', () => {
    expect(service.isTargetAuthorized('ag_prod', { kind: 'ip', value: '10.0.0.42' }, whitelistEntries)).toBe(true);
    expect(service.isTargetAuthorized('ag_prod', { kind: 'ip', value: '10.0.1.42' }, whitelistEntries)).toBe(false);
  });
});
