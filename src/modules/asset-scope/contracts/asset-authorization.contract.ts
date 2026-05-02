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
