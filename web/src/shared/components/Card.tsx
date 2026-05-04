import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from './class-names';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded border border-gray-200 bg-white p-4 shadow-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('mb-3 flex items-center justify-between gap-2', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold text-gray-900', className)}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardBody({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn('text-sm text-gray-700', className)} {...rest}>
      {children}
    </div>
  );
}
