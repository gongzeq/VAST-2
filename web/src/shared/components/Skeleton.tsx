import type { HTMLAttributes } from 'react';

import { cn } from './class-names';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-gray-200',
        className,
      )}
      {...rest}
    />
  );
}
