import { isIP } from 'node:net';

import { AssetScopeBlockedError } from '../../../shared/contracts/foundation.js';
import { type AssetTarget, type AssetWhitelistEntry } from '../contracts/asset-authorization.contract.js';

const normalizeDomain = (domain: string): string => domain.trim().toLowerCase().replace(/\.$/, '');

const ipv4ToNumber = (value: string): number => {
  return value.split('.').reduce((accumulator, octet) => {
    return (accumulator << 8) + Number(octet);
  }, 0) >>> 0;
};

const isIpv4InCidr = (ip: string, cidr: string): boolean => {
  const [network, prefix] = cidr.split('/');
  const parsedPrefix = Number(prefix);

  if (!network || Number.isNaN(parsedPrefix) || parsedPrefix < 0 || parsedPrefix > 32) {
    return false;
  }

  if (isIP(ip) !== 4 || isIP(network) !== 4) {
    return false;
  }

  const mask = parsedPrefix === 0 ? 0 : (0xffffffff << (32 - parsedPrefix)) >>> 0;
  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(network) & mask);
};

export class AssetScopeService {
  isTargetAuthorized(assetGroupId: string, target: AssetTarget, whitelistEntries: AssetWhitelistEntry[]): boolean {
    return whitelistEntries.some((entry) => {
      if (entry.assetGroupId !== assetGroupId) {
        return false;
      }

      if (target.kind === 'domain' && entry.kind === 'root_domain') {
        const candidate = normalizeDomain(target.value);
        const rootDomain = normalizeDomain(entry.rootDomain);

        if (candidate === rootDomain) {
          return true;
        }

        return entry.allowSubdomains && candidate.endsWith(`.${rootDomain}`);
      }

      if (target.kind === 'ip' && entry.kind === 'ip') {
        return target.value === entry.ip;
      }

      if (target.kind === 'ip' && entry.kind === 'cidr') {
        return isIpv4InCidr(target.value, entry.cidr);
      }

      return false;
    });
  }

  assertTargetAuthorized(assetGroupId: string, target: AssetTarget, whitelistEntries: AssetWhitelistEntry[]): void {
    if (!this.isTargetAuthorized(assetGroupId, target, whitelistEntries)) {
      throw new AssetScopeBlockedError({
        asset_group_id: assetGroupId,
        target_ref: target.value,
      });
    }
  }
}
