import { createHash, randomBytes } from 'node:crypto';

import {
  createId,
  SchemaValidationError,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import {
  type InboundMailRequest,
  inboundMailRequestSchema,
  type MailAnalysisMode,
  type MailAnalysisRecord,
  mailAnalysisRecordSchema,
  type MailAttachmentAnalysis,
  type MailGatewayConfig,
  type MailIoc,
  type PhishingLabel,
} from '../contracts/mail-analysis.contract.js';
import {
  type MailAnalysisRepository,
  type MailGatewayRepository,
} from '../contracts/mail-repository.contract.js';
import {
  InMemoryMailAnalysisRepository,
  InMemoryMailGatewayRepository,
} from '../persistence/in-memory-mail-repositories.js';

const MAIL_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

const now = (): string => new Date().toISOString();

const toValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>): string[] => {
  return issues.map((issue) => issue.path.join('.') || issue.message);
};

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const clampRiskScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const labelForScore = (score: number): PhishingLabel => {
  if (score >= 80) {
    return 'suspected';
  }
  if (score >= 50) {
    return 'suspicious';
  }
  return 'clean';
};

const splitHeadersAndBody = (rawMessage: string): { headers: Record<string, string>; body: string } => {
  const separatorMatch = /\r?\n\r?\n/.exec(rawMessage);
  const headerBlock = separatorMatch ? rawMessage.slice(0, separatorMatch.index) : rawMessage;
  const body = separatorMatch ? rawMessage.slice(separatorMatch.index + separatorMatch[0].length) : '';
  const headers: Record<string, string> = {};

  for (const line of headerBlock.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }

  return { headers, body };
};

const parseRecipients = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value.split(',').map((recipient) => recipient.trim()).filter(Boolean);
};

const extractIocs = (body: string): MailIoc[] => {
  const iocs: MailIoc[] = [];
  const seen = new Set<string>();
  const urlMatches = body.match(/https?:\/\/[^\s<>"']+/gi) ?? [];

  for (const url of urlMatches) {
    const normalizedUrl = url.replace(/[),.]+$/u, '');
    const key = `URL:${normalizedUrl}`;
    if (!seen.has(key)) {
      seen.add(key);
      iocs.push({ kind: 'URL', value: normalizedUrl });
    }

    try {
      const domain = new URL(normalizedUrl).hostname.toLowerCase();
      const domainKey = `DOMAIN:${domain}`;
      if (domain && !seen.has(domainKey)) {
        seen.add(domainKey);
        iocs.push({ kind: 'DOMAIN', value: domain });
      }
    } catch {
      continue;
    }
  }

  return iocs;
};

const analyzeBody = (params: {
  body: string;
  headers: Record<string, string>;
  attachments: InboundMailRequest['attachments'];
  includeAttachments: boolean;
}): { riskScore: number; riskSignals: string[]; iocs: MailIoc[]; attachmentAnalyses: MailAttachmentAnalysis[] } => {
  const riskSignals: string[] = [];
  const body = params.body.toLowerCase();
  const iocs = extractIocs(params.body);
  let score = 0;

  if (!params.headers['authentication-results']) {
    score += 10;
    riskSignals.push('missing_authentication_results');
  }
  if (/(urgent|verify|password|account|invoice|payment|login|limited time)/i.test(params.body)) {
    score += 30;
    riskSignals.push('social_engineering_language');
  }
  if (iocs.some((ioc) => ioc.kind === 'URL')) {
    score += 20;
    riskSignals.push('url_present');
  }
  if (/(\.zip|\.scr|\.exe|macro|enable content)/i.test(params.body)) {
    score += 20;
    riskSignals.push('dangerous_attachment_language');
  }
  if (body.includes('credential') || body.includes('mfa')) {
    score += 15;
    riskSignals.push('credential_request');
  }

  const attachmentAnalyses = params.attachments.map((attachment): MailAttachmentAnalysis => {
    if (!params.includeAttachments) {
      return {
        filename: attachment.filename,
        sizeBytes: attachment.sizeBytes,
        contentType: attachment.contentType,
        sha256: attachment.sha256,
        analyzed: false,
        skippedReason: 'message_size_limit',
        fileType: null,
        riskSignals: [],
      };
    }

    const riskyExtension = /\.(exe|scr|js|vbs|jar|zip|docm|xlsm)$/i.test(attachment.filename);
    if (riskyExtension) {
      score += 20;
    }

    return {
      filename: attachment.filename,
      sizeBytes: attachment.sizeBytes,
      contentType: attachment.contentType,
      sha256: attachment.sha256,
      analyzed: true,
      skippedReason: null,
      fileType: attachment.contentType ?? 'unknown',
      riskSignals: riskyExtension ? ['risky_attachment_extension'] : [],
    };
  });

  return {
    riskScore: clampRiskScore(score),
    riskSignals,
    iocs,
    attachmentAnalyses,
  };
};

export class MailAnalysisService {
  readonly #gatewayRepository: MailGatewayRepository;
  readonly #analysisRepository: MailAnalysisRepository;
  readonly #auditLog: InMemoryAuditLog;

  constructor(deps?: {
    gatewayRepository?: MailGatewayRepository;
    analysisRepository?: MailAnalysisRepository;
    auditLog?: InMemoryAuditLog;
  }) {
    this.#gatewayRepository = deps?.gatewayRepository ?? new InMemoryMailGatewayRepository();
    this.#analysisRepository = deps?.analysisRepository ?? new InMemoryMailAnalysisRepository();
    this.#auditLog = deps?.auditLog ?? new InMemoryAuditLog();
  }

  get auditLog(): InMemoryAuditLog {
    return this.#auditLog;
  }

  receiveAnalyzeAndForward(request: unknown, actor: ActorContext): MailAnalysisRecord {
    const parsedRequest = inboundMailRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedRequest.error.issues),
      });
    }

    const normalizedRequest = parsedRequest.data;
    const gateway = this.#gatewayRepository.get(normalizedRequest.gatewayId);
    if (!gateway || !gateway.enabled) {
      this.#audit(actor.actorId, 'MAIL_GATEWAY_REJECTED', normalizedRequest.gatewayId, {
        gateway_id: normalizedRequest.gatewayId,
        reason: 'unknown_or_disabled_gateway',
      });
      throw new SchemaValidationError({
        gateway_id: normalizedRequest.gatewayId,
        reason: 'unknown_or_disabled_gateway',
      }, 'Mail gateway is unknown or disabled.');
    }

    if (gateway.inboundSourceRefs.length > 0 && !gateway.inboundSourceRefs.includes(normalizedRequest.sourceRef)) {
      this.#audit(actor.actorId, 'MAIL_GATEWAY_REJECTED', gateway.gatewayId, {
        gateway_id: gateway.gatewayId,
        source_ref: normalizedRequest.sourceRef,
        reason: 'source_not_allowed',
      });
      throw new SchemaValidationError({
        gateway_id: gateway.gatewayId,
        source_ref: normalizedRequest.sourceRef,
        reason: 'source_not_allowed',
      }, 'Mail source is not allowed for this gateway.');
    }

    const record = this.#buildRecord(normalizedRequest, gateway);
    const persisted = this.#analysisRepository.save(record);

    this.#audit(actor.actorId, 'MAIL_ANALYSIS_COMPLETED', persisted.mailTaskId, {
      mail_task_id: persisted.mailTaskId,
      gateway_id: persisted.gatewayId,
      mail_direction: 'inbound',
      analysis_mode: persisted.analysisMode,
      phishing_label: persisted.phishingLabel,
      risk_score: persisted.riskScore,
      attachment_count: persisted.attachmentAnalyses.length,
    });
    this.#audit(actor.actorId, 'MAIL_FORWARDED', persisted.mailTaskId, {
      mail_task_id: persisted.mailTaskId,
      gateway_id: persisted.gatewayId,
      downstream_host: persisted.forwardingResult.downstreamHost,
      analysis_mode: persisted.analysisMode,
    });

    return mailAnalysisRecordSchema.parse(persisted);
  }

  #buildRecord(request: InboundMailRequest, gateway: MailGatewayConfig): MailAnalysisRecord {
    const mailTaskId = createId('mail_task');
    const receivedAt = request.receivedAt ?? now();
    const messageSizeBytes = request.sizeBytes ?? Buffer.byteLength(request.rawMessage, 'utf8');
    const parsedMail = splitHeadersAndBody(request.rawMessage);
    const bodySha256 = sha256(parsedMail.body);
    const analysisMode: MailAnalysisMode = request.analysisAvailable
      ? messageSizeBytes > MAIL_SIZE_LIMIT_BYTES ? 'BODY_ONLY_SIZE_LIMIT' : 'FULL'
      : 'UNAVAILABLE';

    if (!request.analysisAvailable) {
      const securityHeaders = {
        'X-Security-Task-ID': mailTaskId,
        'X-Security-Analysis': 'unavailable',
      };

      return {
        mailTaskId,
        gatewayId: gateway.gatewayId,
        assetGroupId: gateway.assetGroupId,
        sourceRef: request.sourceRef,
        receivedAt,
        subject: parsedMail.headers.subject ?? null,
        from: parsedMail.headers.from ?? null,
        recipients: parseRecipients(parsedMail.headers.to),
        messageSizeBytes,
        bodySha256,
        rawBodyStored: false,
        analysisMode,
        analysisStatus: 'UNAVAILABLE',
        phishingLabel: null,
        riskScore: null,
        securityHeaders,
        attachmentAnalyses: [],
        iocs: [],
        forwardingResult: this.#buildForwardingResult(gateway, securityHeaders),
        riskSignals: [],
        unavailableReason: 'analysis_service_unavailable',
      };
    }

    const includeAttachments = analysisMode === 'FULL';
    const analysis = analyzeBody({
      body: parsedMail.body,
      headers: parsedMail.headers,
      attachments: request.attachments,
      includeAttachments,
    });
    const phishingLabel = labelForScore(analysis.riskScore);
    const analysisHeader = analysisMode === 'BODY_ONLY_SIZE_LIMIT' ? 'body-only-size-limit' : 'complete';
    const securityHeaders = {
      'X-Security-Phishing': phishingLabel,
      'X-Security-Risk-Score': String(analysis.riskScore),
      'X-Security-Task-ID': mailTaskId,
      'X-Security-Analysis': analysisHeader,
    };

    return {
      mailTaskId,
      gatewayId: gateway.gatewayId,
      assetGroupId: gateway.assetGroupId,
      sourceRef: request.sourceRef,
      receivedAt,
      subject: parsedMail.headers.subject ?? null,
      from: parsedMail.headers.from ?? null,
      recipients: parseRecipients(parsedMail.headers.to),
      messageSizeBytes,
      bodySha256,
      rawBodyStored: false,
      analysisMode,
      analysisStatus: 'ANALYZED',
      phishingLabel,
      riskScore: analysis.riskScore,
      securityHeaders,
      attachmentAnalyses: analysis.attachmentAnalyses,
      iocs: analysis.iocs,
      forwardingResult: this.#buildForwardingResult(gateway, securityHeaders),
      riskSignals: analysis.riskSignals,
      unavailableReason: null,
    };
  }

  #buildForwardingResult(gateway: MailGatewayConfig, headers: Record<string, string>): MailAnalysisRecord['forwardingResult'] {
    return {
      status: 'FORWARDED',
      downstreamHost: gateway.downstreamHost,
      downstreamPort: gateway.downstreamPort,
      forwardedAt: now(),
      appliedHeaders: {
        ...headers,
        'X-Security-Forward-Ref': `forward_${randomBytes(8).toString('hex')}`,
      },
    };
  }

  #audit(
    actorId: string,
    action: Parameters<InMemoryAuditLog['append']>[0]['action'],
    resourceId: string,
    details: SafeDetails,
  ): void {
    this.#auditLog.append({
      actorId,
      action,
      resourceType: 'phishing_mail',
      resourceId,
      details,
    });
  }
}
