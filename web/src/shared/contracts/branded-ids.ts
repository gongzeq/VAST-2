/**
 * Branded ID aliases. These are nominal types so a TaskId cannot be passed
 * where an AssetGroupId is expected.
 */

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type TaskId = Brand<string, 'TaskId'>;
export type AssetGroupId = Brand<string, 'AssetGroupId'>;
export type DiscoveredAssetId = Brand<string, 'DiscoveredAssetId'>;
export type ClarificationId = Brand<string, 'ClarificationId'>;
export type AuditLogEntryId = Brand<string, 'AuditLogEntryId'>;
export type LlmProviderId = Brand<string, 'LlmProviderId'>;
export type LogSourceId = Brand<string, 'LogSourceId'>;
export type MailSourceId = Brand<string, 'MailSourceId'>;
export type MailTaskId = Brand<string, 'MailTaskId'>;

export const asTaskId = (raw: string): TaskId => raw as TaskId;
export const asAssetGroupId = (raw: string): AssetGroupId => raw as AssetGroupId;
export const asDiscoveredAssetId = (raw: string): DiscoveredAssetId => raw as DiscoveredAssetId;
export const asClarificationId = (raw: string): ClarificationId => raw as ClarificationId;
export const asAuditLogEntryId = (raw: string): AuditLogEntryId => raw as AuditLogEntryId;
export const asLlmProviderId = (raw: string): LlmProviderId => raw as LlmProviderId;
export const asLogSourceId = (raw: string): LogSourceId => raw as LogSourceId;
export const asMailSourceId = (raw: string): MailSourceId => raw as MailSourceId;
export const asMailTaskId = (raw: string): MailTaskId => raw as MailTaskId;
