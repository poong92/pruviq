/** 7-day price sparkline — inline SVG, no dependencies */
interface Props {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export default function MiniSparkline({ data, width = 120, height = 32, positive = true }: Props) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const color = positive ? 'var(--color-up)' : 'var(--color-down)';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} class="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
