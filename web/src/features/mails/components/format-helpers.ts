/**
 * Formatting helpers for the mail analysis surface.
 *
 * Centralised so list and detail share identical "(无主题)" / "(发件人未识别)"
 * fallback text and so tests can assert on a single source of truth (R4).
 */
const KILOBYTE = 1024;
const MEGABYTE = 1024 * 1024;

export const SUBJECT_FALLBACK = '(无主题)';
export const SENDER_FALLBACK = '(发件人未识别)';
export const RISK_SCORE_FALLBACK = '—';

export function formatSubject(subject: string | null): string {
  if (subject === null || subject.length === 0) return SUBJECT_FALLBACK;
  return subject;
}

export function formatSender(from: string | null): string {
  if (from === null || from.length === 0) return SENDER_FALLBACK;
  return from;
}

export function formatRiskScore(riskScore: number | null): string {
  if (riskScore === null) return RISK_SCORE_FALLBACK;
  return String(riskScore);
}

export function formatBytes(value: number): string {
  if (value < KILOBYTE) return `${value} B`;
  if (value < MEGABYTE) return `${(value / KILOBYTE).toFixed(1)} KB`;
  return `${(value / MEGABYTE).toFixed(1)} MB`;
}

export function formatRecipientsPreview(recipients: string[], visible = 3): {
  visible: string[];
  more: number;
} {
  if (recipients.length <= visible) {
    return { visible: recipients, more: 0 };
  }
  return { visible: recipients.slice(0, visible), more: recipients.length - visible };
}
