import {
  type AttackClassification,
  type NormalizedWebLogFields,
  type SecurityLogSeverity,
} from '../contracts/log-ingestion.contract.js';
import { type ParsedSecurityLogEntry } from './security-log-parser.js';

export type RedactedSecurityLogProjection = {
  severity: SecurityLogSeverity;
  webFields: NormalizedWebLogFields | null;
  classification: AttackClassification | null;
  redactedFields: string[];
};

const decodeSafely = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeAttackType = (value: string): string => {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
};

export class SecurityLogRedactor {
  redact(entry: ParsedSecurityLogEntry): RedactedSecurityLogProjection {
    const redactedFields = new Set<string>();
    const uriPath = this.#stripQueryString(entry.uri, redactedFields);

    for (const sensitiveKey of entry.sensitiveKeys) {
      redactedFields.add(sensitiveKey);
    }

    const classification = this.#classifyAttack(entry, uriPath);
    const severity = this.#deriveSeverity(entry, classification);
    const webFields = this.#buildWebFields(entry, uriPath);

    return {
      severity,
      webFields,
      classification,
      redactedFields: Array.from(redactedFields.values()).sort(),
    };
  }

  #buildWebFields(entry: ParsedSecurityLogEntry, uriPath: string | null): NormalizedWebLogFields | null {
    if (!entry.httpMethod && !uriPath && !entry.statusCode && !entry.userAgent && entry.requestSize === null && entry.responseSize === null) {
      return null;
    }

    return {
      httpMethod: entry.httpMethod,
      uriPath,
      statusCode: entry.statusCode,
      userAgentSummary: this.#summarizeUserAgent(entry.userAgent),
      requestSize: entry.requestSize,
      responseSize: entry.responseSize,
    };
  }

  #stripQueryString(uri: string | null, redactedFields: Set<string>): string | null {
    if (!uri) {
      return null;
    }

    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      try {
        const parsedUrl = new URL(uri);
        if (parsedUrl.search.length > 0) {
          redactedFields.add('uri.query');
        }
        return parsedUrl.pathname || '/';
      } catch {
        const fallbackPath = uri.split('?')[0] ?? null;
        if (uri.includes('?')) {
          redactedFields.add('uri.query');
        }
        return fallbackPath;
      }
    }

    if (uri.includes('?')) {
      redactedFields.add('uri.query');
      return uri.split('?')[0] ?? null;
    }

    return uri;
  }

  #summarizeUserAgent(userAgent: string | null): string | null {
    if (!userAgent) {
      return null;
    }

    const normalized = userAgent.trim();
    if (!normalized) {
      return null;
    }

    const [firstToken] = normalized.split(/\s+/);
    return firstToken ? firstToken.slice(0, 120) : normalized.slice(0, 120);
  }

  #classifyAttack(entry: ParsedSecurityLogEntry, uriPath: string | null): AttackClassification | null {
    if (entry.attackTypeHint) {
      return {
        attackType: normalizeAttackType(entry.attackTypeHint),
        classificationRuleId: entry.ruleId,
        confidence: 0.95,
        explanation: 'Used explicit attack-type hint supplied by the parsed log.',
      };
    }

    const haystack = [
      entry.ruleName,
      entry.ruleId,
      entry.action,
      uriPath,
      entry.uri ? decodeSafely(entry.uri) : null,
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' ')
      .toLowerCase();

    if (/(union\s+select|select\s+.*from|sql\s*injection|sqli|or\s+1=1)/.test(haystack)) {
      return {
        attackType: 'SQL_INJECTION',
        classificationRuleId: entry.ruleId,
        confidence: 0.82,
        explanation: 'Matched SQL injection indicators in the log payload.',
      };
    }

    if (/(\.\.\/|%2e%2e%2f|path\s+traversal)/.test(haystack)) {
      return {
        attackType: 'PATH_TRAVERSAL',
        classificationRuleId: entry.ruleId,
        confidence: 0.8,
        explanation: 'Matched path traversal indicators in the log payload.',
      };
    }

    if (/(<script|%3cscript|cross\s*site\s*scripting|xss)/.test(haystack)) {
      return {
        attackType: 'CROSS_SITE_SCRIPTING',
        classificationRuleId: entry.ruleId,
        confidence: 0.78,
        explanation: 'Matched cross-site scripting indicators in the log payload.',
      };
    }

    if (/(brute\s*force|credential\s*stuffing|login\s*failed|auth\s*failed)/.test(haystack)) {
      return {
        attackType: 'BRUTE_FORCE',
        classificationRuleId: entry.ruleId,
        confidence: 0.76,
        explanation: 'Matched authentication abuse indicators in the log payload.',
      };
    }

    if (/(command\s*injection|;\s*cat\s+|\|\s*sh|`[^`]+`)/.test(haystack)) {
      return {
        attackType: 'COMMAND_INJECTION',
        classificationRuleId: entry.ruleId,
        confidence: 0.79,
        explanation: 'Matched command injection indicators in the log payload.',
      };
    }

    if (/(block|blocked|deny|denied)/.test(haystack) || entry.statusCode === 401 || entry.statusCode === 403 || entry.statusCode === 429) {
      return {
        attackType: 'POLICY_BLOCK',
        classificationRuleId: entry.ruleId,
        confidence: 0.58,
        explanation: 'The event reflects a blocked or denied request.',
      };
    }

    return null;
  }

  #deriveSeverity(entry: ParsedSecurityLogEntry, classification: AttackClassification | null): SecurityLogSeverity {
    if (entry.severity) {
      return entry.severity;
    }

    switch (classification?.attackType) {
      case 'SQL_INJECTION':
      case 'COMMAND_INJECTION':
        return 'HIGH';
      case 'PATH_TRAVERSAL':
      case 'CROSS_SITE_SCRIPTING':
      case 'BRUTE_FORCE':
        return 'MEDIUM';
      case 'POLICY_BLOCK':
        return 'LOW';
      default:
        break;
    }

    if ((entry.statusCode ?? 0) >= 500) {
      return 'MEDIUM';
    }
    if ((entry.statusCode ?? 0) >= 400) {
      return 'LOW';
    }
    if (entry.action && /(block|deny)/i.test(entry.action)) {
      return 'LOW';
    }

    return 'INFO';
  }
}
