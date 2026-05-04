/**
 * URL state schema for the task list page. Parses search params with zod so
 * malformed values fall back to defaults rather than crashing.
 */
import { z } from 'zod';

import { taskLifecycleStageSchema } from '@/shared/contracts/task-execution.contract';
import { workflowTypeSchema } from '@/shared/contracts/task-plan.contract';

const sortableFieldSchema = z.enum(['createdAt', 'updatedAt']);
const sortDirectionSchema = z.enum(['asc', 'desc']);

export const sortKeySchema = z
  .string()
  .transform((raw) => {
    const [field = '', dir = 'desc'] = raw.split(':');
    return { field, dir };
  })
  .pipe(
    z.object({
      field: sortableFieldSchema,
      dir: sortDirectionSchema,
    }),
  );

export type TaskListSortKey = z.infer<typeof sortKeySchema>;

export const taskListFilterSchema = z.object({
  workflowType: workflowTypeSchema.optional(),
  lifecycleStage: taskLifecycleStageSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: sortKeySchema.optional(),
});

export type TaskListFilter = z.infer<typeof taskListFilterSchema>;

export function parseTaskListFilter(searchParams: URLSearchParams): TaskListFilter {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  const result = taskListFilterSchema.safeParse(obj);
  if (result.success) return result.data;
  // Fallback to defaults if anything failed to parse.
  return taskListFilterSchema.parse({});
}

export function serializeTaskListFilter(filter: TaskListFilter): URLSearchParams {
  const sp = new URLSearchParams();
  if (filter.workflowType) sp.set('workflowType', filter.workflowType);
  if (filter.lifecycleStage) sp.set('lifecycleStage', filter.lifecycleStage);
  if (filter.page !== 1) sp.set('page', String(filter.page));
  if (filter.pageSize !== 20) sp.set('pageSize', String(filter.pageSize));
  if (filter.sort) sp.set('sort', `${filter.sort.field}:${filter.sort.dir}`);
  return sp;
}
