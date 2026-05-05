/**
 * Tiny inline-SVG sparkline.
 *
 * The dashboard PRD requires every metric card to carry a 1–2 sentence
 * text summary alongside any chart (component-guidelines.md "no chart-only
 * signaling"). The sparkline is purely decorative reinforcement — it must
 * still expose an `aria-label` so screen readers can read the trend.
 *
 * No external chart library is installed; this is intentional (see
 * `component-guidelines.md` "Forbidden — pulling in any other component
 * runtime lib without a separate spec change").
 */
export interface SparklineProps {
  values: number[];
  ariaLabel: string;
  /** Width/height in CSS pixels. Defaults sized for the dashboard cards. */
  width?: number;
  height?: number;
  /** Stroke colour. Defaults to a muted blue. */
  stroke?: string;
}

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 32;
const STROKE = '#2563eb';

export function Sparkline({
  values,
  ariaLabel,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  stroke = STROKE,
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="#d1d5db"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  const toY = (value: number): number => {
    if (range === 0) return height / 2;
    const normalized = (value - min) / range;
    // Y axis is inverted in SVG; pad 2px on each side.
    return height - 2 - normalized * (height - 4);
  };

  const points = values
    .map((value, index) => `${(index * stepX).toFixed(2)},${toY(value).toFixed(2)}`)
    .join(' ');

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
