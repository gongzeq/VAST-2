/**
 * Pagination controls for the audit log page.
 */
import { Button } from '@/shared/components/Button';
import { Select } from '@/shared/components/Select';

export interface AuditLogPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export function AuditLogPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: AuditLogPaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3"
      data-testid="audit-pagination"
    >
      <div className="text-xs text-gray-600">
        共 {total} 条 · 第 {page} / {lastPage} 页
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-gray-600">
          每页
          <Select
            data-testid="audit-pagination-pagesize"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          data-testid="audit-pagination-prev"
        >
          上一页
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
          data-testid="audit-pagination-next"
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
