import {
  type LogSourceConfig,
  type NormalizedWebLogFields,
  type SecurityLogSeverity,
} from '../contracts/log-ingestion.contract.js';

const commonAccessLogPattern = /^(?<srcIp>\S+)\s+\S+\s+\S+\s+\[(?<timestamp>[^\]]+)\]\s+"(?<method>[A-Z]+)\s+(?<uri>\S+)\s+(?<protocol>[^"]+)"\s+(?<status>\d{3})\s+(?<bytes>\S+)(?:\s+"[^"]*"\s+"(?<userAgent>[^"]*)")?$/;

const monthMap: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

const normalizeHost = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '') || null;
};

const toIsoTimestamp = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  const match = value.match(/^(?<day>\d{2})\/(?<month>[A-Za-z]{3})\/(?<year>\d{4}):(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})\s+(?<offset>[+-]\d{4})$/);
  if (!match?.groups) {
    return null;
  }

  const month = monthMap[match.groups.month];
  if (!month) {
    return null;
  }

  const offset = match.groups.offset;
  const normalizedOffset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
  return new Date(
    `${match.groups.year}-${month}-${match.groups.day}T${match.groups.hour}:${match.groups.minute}:${match.groups.second}${normalizedOffset}`,
  ).toISOString();
};

const parseRequestLine = (requestLine: string | null): Pick<NormalizedWebLogFields, 'httpMethod'> & { uri: string | null; protocol: string | null } => {
  if (!requestLine) {
    return {
      httpMethod: null,
      uri: null,
      protocol: null,
    };
  }

  const match = requestLine.match(/^(?<method>[A-Z]+)\s+(?<uri>\S+)(?:\s+HTTP\/(?<protocol>[0-9.]+))?$/);
  if (!match?.groups) {
    return {
      httpMethod: null,
      uri: null,
      protocol: null,
    };
  }

  return {
    httpMethod: match.groups.method ?? null,
    uri: match.groups.uri ?? null,
    protocol: match.groups.protocol ?? null,
  };
};

const isSensitiveKey = (key: string): boolean => {
  return /(cookie|authorization|token|secret|password|passwd|credential|account|username)/i.test(key);
};

const readString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
};

export type ParsedSecurityLogEntry = {
  originalEventTime: string | null;
  srcIp: string | null;
  srcPort: number | null;
  dstIp: string | null;
  dstDomain: string | null;
  dstPort: number | null;
  protocol: string | null;
  action: string | null;
  ruleId: string | null;
  ruleName: string | null;
  severity: SecurityLogSeverity | null;
  httpMethod: string | null;
  uri: string | null;
  statusCode: number | null;
  userAgent: string | null;
  requestSize: number | null;
  responseSize: number | null;
  attackTypeHint: string | null;
  sensitiveKeys: string[];
};

export class SecurityLogParser {
  parse(payload: string, source: LogSourceConfig): ParsedSecurityLogEntry {
    switch (source.parserFormat) {
      case 'JSON':
        return this.#parseJsonPayload(payload);
      case 'NGINX_ACCESS':
      case 'APACHE_ACCESS':
        return this.#parseCommonAccessLog(payload);
      default:
        throw new Error(`Unsupported parser format: ${source.parserFormat}`);
    }
  }

  #parseJsonPayload(payload: string): ParsedSecurityLogEntry {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const requestLine = readString(parsed.request);
    const requestParts = parseRequestLine(requestLine);
    const headers = parsed.headers && typeof parsed.headers === 'object'
      ? parsed.headers as Record<string, unknown>
      : null;

    const sensitiveKeys = new Set<string>();
    for (const key of Object.keys(parsed)) {
      if (isSensitiveKey(key)) {
        sensitiveKeys.add(key.toLowerCase());
      }
    }
    if (headers) {
      for (const key of Object.keys(headers)) {
        if (isSensitiveKey(key)) {
          sensitiveKeys.add(key.toLowerCase());
        }
      }
    }

    return {
      originalEventTime: toIsoTimestamp(
        readString(parsed.event_time)
          ?? readString(parsed.timestamp)
          ?? readString(parsed.time)
          ?? readString(parsed['@timestamp']),
      ),
      srcIp: readString(parsed.src_ip) ?? readString(parsed.client_ip) ?? readString(parsed.remote_addr),
      srcPort: readNumber(parsed.src_port) ?? readNumber(parsed.client_port),
      dstIp: readString(parsed.dst_ip) ?? readString(parsed.server_ip),
      dstDomain: normalizeHost(readString(parsed.dst_domain) ?? readString(parsed.host) ?? readString(parsed.server_name)),
      dstPort: readNumber(parsed.dst_port) ?? readNumber(parsed.server_port),
      protocol: readString(parsed.protocol) ?? requestParts.protocol,
      action: readString(parsed.action) ?? readString(parsed.decision),
      ruleId: readString(parsed.rule_id),
      ruleName: readString(parsed.rule_name) ?? readString(parsed.rule),
      severity: this.#mapSeverity(readString(parsed.severity)),
      httpMethod: readString(parsed.http_method) ?? readString(parsed.method) ?? requestParts.httpMethod,
      uri: readString(parsed.uri) ?? readString(parsed.path) ?? readString(parsed.request_uri) ?? requestParts.uri,
      statusCode: readNumber(parsed.status_code) ?? readNumber(parsed.status) ?? readNumber(parsed.response_status),
      userAgent: readString(parsed.user_agent) ?? readString(parsed.http_user_agent),
      requestSize: readNumber(parsed.request_size) ?? readNumber(parsed.bytes_received),
      responseSize: readNumber(parsed.response_size) ?? readNumber(parsed.bytes_sent) ?? readNumber(parsed.body_bytes_sent),
      attackTypeHint: readString(parsed.attack_type) ?? readString(parsed.classification) ?? readString(parsed.signature),
      sensitiveKeys: Array.from(sensitiveKeys.values()).sort(),
    };
  }

  #parseCommonAccessLog(payload: string): ParsedSecurityLogEntry {
    const match = payload.match(commonAccessLogPattern);
    if (!match?.groups) {
      throw new Error('Access log line did not match the supported parser format.');
    }

    return {
      originalEventTime: toIsoTimestamp(match.groups.timestamp ?? null),
      srcIp: match.groups.srcIp ?? null,
      srcPort: null,
      dstIp: null,
      dstDomain: null,
      dstPort: null,
      protocol: match.groups.protocol ?? null,
      action: null,
      ruleId: null,
      ruleName: null,
      severity: null,
      httpMethod: match.groups.method ?? null,
      uri: match.groups.uri ?? null,
      statusCode: readNumber(match.groups.status),
      userAgent: match.groups.userAgent ?? null,
      requestSize: null,
      responseSize: readNumber(match.groups.bytes === '-' ? null : match.groups.bytes),
      attackTypeHint: null,
      sensitiveKeys: [],
    };
  }

  #mapSeverity(value: string | null): SecurityLogSeverity | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    switch (normalized) {
      case 'critical':
        return 'CRITICAL';
      case 'high':
        return 'HIGH';
      case 'medium':
        return 'MEDIUM';
      case 'low':
        return 'LOW';
      case 'info':
      case 'informational':
        return 'INFO';
      default:
        return null;
    }
  }
}
