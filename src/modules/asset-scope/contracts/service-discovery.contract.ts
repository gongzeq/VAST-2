import { z } from 'zod';

import { executionIntensitySchema } from '../../../shared/contracts/foundation.js';
import { assetTargetSchema } from './asset-authorization.contract.js';

export const serviceDiscoveryRequestSchema = z.object({
  taskId: z.string().min(1),
  assetGroupId: z.string().min(1),
  targets: z.array(assetTargetSchema).min(1),
  intensity: executionIntensitySchema,
  portRange: z.string().optional(),
});

export type ServiceDiscoveryRequest = z.infer<typeof serviceDiscoveryRequestSchema>;

export const discoveredServiceRecordSchema = z.object({
  serviceId: z.string().min(1),
  target: assetTargetSchema,
  port: z.number().int().min(1).max(65535),
  protocol: z.string().min(1),
  state: z.string().min(1),
  service: z.string().nullable(),
  version: z.string().nullable(),
  fingerprint: z.string().nullable(),
  discoveredAt: z.string().min(1),
});

export type DiscoveredServiceRecord = z.infer<typeof discoveredServiceRecordSchema>;

export const serviceDiscoveryResultSchema = z.object({
  scanId: z.string().min(1),
  taskId: z.string().min(1),
  assetGroupId: z.string().min(1),
  status: z.enum(['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED']),
  startedAt: z.string().min(1),
  completedAt: z.string().nullable(),
  targetsScanned: z.number().int().min(0),
  services: z.array(discoveredServiceRecordSchema),
  errors: z.array(z.object({
    target: z.string(),
    error: z.string(),
  })).default([]),
});

export type ServiceDiscoveryResult = z.infer<typeof serviceDiscoveryResultSchema>;
