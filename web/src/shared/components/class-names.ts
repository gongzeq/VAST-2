/**
 * Tiny utility for joining class names without pulling in clsx as a dep.
 */
export function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}
