import { z } from 'zod';

import { phishingLabelSchema } from '@/shared/contracts/mail-analysis.contract';

const mailSortFieldSchema = z.enum(['receivedAt', 'riskScore', 'messageSizeBytes']);
const sortDirectionSchema = z.enum(['asc', 'desc']);

export const mailSortKeySchema = z
  .string()
  .transform((raw) => {
    const [field = 'receivedAt', dir = 'desc'] = raw.split(':');
    return { field, dir };
  })
  .pipe(
    z.object({
      field: mailSortFieldSchema,
      dir: sortDirectionSchema,
    }),
  );

export type MailSortKey = z.infer<typeof mailSortKeySchema>;

const isoDateString = z.string().refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  { message: 'expected ISO datetime' },
);

export const mailListFilterSchema = z.object({
  assetGroupId: z.string().min(1).optional(),
  gatewayId: z.string().min(1).optional(),
  phishingLabel: phishingLabelSchema.optional(),
  since: isoDateString.optional(),
  until: isoDateString.optional(),
  sort: mailSortKeySchema.default('receivedAt:desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type MailListFilter = z.infer<typeof mailListFilterSchema>;

export const DEFAULT_MAIL_PAGE_SIZE = 25;

export function parseMailListFilter(searchParams: URLSearchParams): MailListFilter {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  const result = mailListFilterSchema.safeParse(obj);
  if (result.success) return result.data;
  return mailListFilterSchema.parse({});
}

export function serializeMailListFilter(filter: MailListFilter): URLSearchParams {
  const sp = new URLSearchParams();
  if (filter.assetGroupId) sp.set('assetGroupId', filter.assetGroupId);
  if (filter.gatewayId) sp.set('gatewayId', filter.gatewayId);
  if (filter.phishingLabel) sp.set('phishingLabel', filter.phishingLabel);
  if (filter.since) sp.set('since', filter.since);
  if (filter.until) sp.set('until', filter.until);
  if (filter.page !== 1) sp.set('page', String(filter.page));
  if (filter.pageSize !== DEFAULT_MAIL_PAGE_SIZE) sp.set('pageSize', String(filter.pageSize));
  if (filter.sort.field !== 'receivedAt' || filter.sort.dir !== 'desc') {
    sp.set('sort', `${filter.sort.field}:${filter.sort.dir}`);
  }
  return sp;
}
