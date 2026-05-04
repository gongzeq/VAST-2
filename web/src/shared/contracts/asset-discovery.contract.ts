/**
 * Frontend mirror of src/modules/asset-scope/contracts/asset-discovery.contract.ts.
 */
import { z } from 'zod';

import { assetTargetSchema } from './asset-authorization.contract';
import {
  assetDiscoveryStateSchema,
  executionIntensitySchema,
} from './foundation';

export const assetDiscoveryRequestSchema = z.object({
  taskId: z.string().min(1),
  assetGroupId: z.string().min(1),
  targets: z.array(z.string().min(1)).min(1),
  intensity: executionIntensitySchema,
});

export type AssetDiscoveryRequest = z.infer<typeof assetDiscoveryRequestSchema>;

export const httpProbeSummarySchema = z.object({
  url: z.string().nullable(),
  statusCode: z.number().int().nullable(),
  title: z.string().nullable(),
  technologies: z.array(z.string()).default([]),
});

export type HttpProbeSummary = z.infer<typeof httpProbeSummarySchema>;

export const discoveredAssetRecordSchema = z.object({
  discoveredAssetId: z.string().min(1),
  assetGroupId: z.string().min(1),
  sourceTarget: z.string().min(1),
  target: assetTargetSchema,
  status: assetDiscoveryStateSchema,
  probe: httpProbeSummarySchema.nullable(),
  discoveredAt: z.string().min(1),
});

export type DiscoveredAssetRecord = z.infer<typeof discoveredAssetRecordSchema>;

export const assetDiscoveryResultSchema = z.object({
  discoveryId: z.string().min(1),
  taskId: z.string().min(1),
  assetGroupId: z.string().min(1),
  status: z.enum(['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED']),
  startedAt: z.string().min(1),
  completedAt: z.string().nullable(),
  targetsScanned: z.number().int().min(0),
  discoveries: z.array(discoveredAssetRecordSchema),
  errors: z
    .array(
      z.object({
        target: z.string(),
        error: z.string(),
      }),
    )
    .default([]),
});

export type AssetDiscoveryResult = z.infer<typeof assetDiscoveryResultSchema>;

export const discoveredAssetListResponseSchema = z.object({
  items: z.array(discoveredAssetRecordSchema),
});

export type DiscoveredAssetListResponse = z.infer<typeof discoveredAssetListResponseSchema>;
