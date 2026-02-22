/** 7-day price sparkline — inline SVG, no dependencies */
import { useMemo } from 'preact/hooks';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export default function MiniSparkline({ data, width = 120, height = 32, positive = true }: Props) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;

  const points = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    const pad = 2;
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - pad - ((v - min) / range) * (height - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, width, height]);

  const color = positive ? 'var(--color-up)' : 'var(--color-down)';
  const label = positive ? 'trending up' : 'trending down';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} class="inline-block" role="img" aria-label={`7-day sparkline ${label}`}>
      <title>Sparkline: {label}</title>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
