import { createId } from '../../../shared/contracts/foundation.js';
import {
  type AttackTrendBucket,
  type NormalizedSecurityLogEvent,
} from '../contracts/log-ingestion.contract.js';

const truncateToHour = (value: string): string => {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
};

const addHour = (value: string): string => {
  const date = new Date(value);
  date.setUTCHours(date.getUTCHours() + 1);
  return date.toISOString();
};

export class AttackTrendAggregator {
  aggregate(events: NormalizedSecurityLogEvent[]): AttackTrendBucket[] {
    const buckets = new Map<string, AttackTrendBucket>();

    for (const event of events) {
      const windowStart = truncateToHour(event.eventTime);
      const windowEnd = addHour(windowStart);
      const attackType = event.classification?.attackType ?? 'UNCLASSIFIED';
      const key = [
        event.assetGroupId,
        windowStart,
        windowEnd,
        event.logType,
        attackType,
        event.severity,
        event.srcIp ?? '',
        event.targetAssetId ?? '',
        event.action ?? '',
      ].join('|');

      const existing = buckets.get(key);
      if (existing) {
        existing.eventCount += 1;
        continue;
      }

      buckets.set(key, {
        bucketId: createId('trend'),
        assetGroupId: event.assetGroupId,
        windowStart,
        windowEnd,
        logType: event.logType,
        attackType,
        severity: event.severity,
        srcIpOrCidr: event.srcIp,
        targetAssetId: event.targetAssetId,
        action: event.action,
        eventCount: 1,
      });
    }

    return Array.from(buckets.values()).map((bucket) => structuredClone(bucket));
  }
}
