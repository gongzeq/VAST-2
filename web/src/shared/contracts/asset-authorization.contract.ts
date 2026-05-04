/**
 * Frontend mirror of src/modules/asset-scope/contracts/asset-authorization.contract.ts.
 * Adds an `assetGroupSchema` aggregate (not in backend) for the UI listing
 * endpoint `/api/asset-groups`.
 */
import { z } from 'zod';

export const assetTargetSchema = z.object({
  kind: z.enum(['domain', 'ip']),
  value: z.string().min(1),
});

export type AssetTarget = z.infer<typeof assetTargetSchema>;

export const rootDomainWhitelistEntrySchema = z.object({
  kind: z.literal('root_domain'),
  assetGroupId: z.string().min(1),
  rootDomain: z.string().min(1),
  allowSubdomains: z.boolean().default(true),
});

export const cidrWhitelistEntrySchema = z.object({
  kind: z.literal('cidr'),
  assetGroupId: z.string().min(1),
  cidr: z.string().min(1),
});

export const ipWhitelistEntrySchema = z.object({
  kind: z.literal('ip'),
  assetGroupId: z.string().min(1),
  ip: z.string().min(1),
});

export const assetWhitelistEntrySchema = z.discriminatedUnion('kind', [
  rootDomainWhitelistEntrySchema,
  cidrWhitelistEntrySchema,
  ipWhitelistEntrySchema,
]);

export type AssetWhitelistEntry = z.infer<typeof assetWhitelistEntrySchema>;

/**
 * UI-side aggregate. `/api/asset-groups` and `/api/asset-groups/:id` return
 * this shape composed from backend repositories.
 */
export const assetGroupSchema = z.object({
  assetGroupId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  ownerActorIds: z.array(z.string().min(1)),
  whitelistEntries: z.array(assetWhitelistEntrySchema),
  createdAt: z.string().min(1),
});

export type AssetGroup = z.infer<typeof assetGroupSchema>;

export const assetGroupListResponseSchema = z.object({
  items: z.array(assetGroupSchema),
});

export type AssetGroupListResponse = z.infer<typeof assetGroupListResponseSchema>;
