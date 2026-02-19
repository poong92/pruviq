import { useRef, useCallback } from 'preact/hooks';

interface DiscreteSliderProps {
  label: string;
  values: number[];
  value: number;
  defaultValue: number;
  unit?: string;
  onChange: (value: number) => void;
}

export default function DiscreteSlider({
  label,
  values,
  value,
  defaultValue,
  unit = '%',
  onChange,
}: DiscreteSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const currentIndex = values.indexOf(value);
  const fillPct = (currentIndex / (values.length - 1)) * 100;

  const resolveIndex = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const idx = Math.round(pct * (values.length - 1));
      onChange(values[idx]);
    },
    [values, onChange]
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      const move = (ev: PointerEvent) => resolveIndex(ev.clientX);
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      resolveIndex(e.clientX);
    },
    [resolveIndex]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      let idx = currentIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        idx = Math.min(values.length - 1, currentIndex + 1);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        idx = Math.max(0, currentIndex - 1);
        e.preventDefault();
      } else if (e.key === 'Home') {
        idx = 0;
        e.preventDefault();
      } else if (e.key === 'End') {
        idx = values.length - 1;
        e.preventDefault();
      } else {
        return;
      }
      onChange(values[idx]);
    },
    [values, currentIndex, onChange]
  );

  return (
    <div class="mb-5">
      <div class="flex justify-between items-center mb-2">
        <span class="font-mono text-xs text-[--color-text-muted]">{label}</span>
        <span class="font-mono text-lg font-bold text-[--color-accent]">{value}{unit}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={values[0]}
        aria-valuemax={values[values.length - 1]}
        aria-valuenow={value}
        aria-valuetext={`${value}${unit}`}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        class="relative h-10 cursor-pointer flex items-center touch-none outline-none focus:ring-1 focus:ring-[--color-accent] rounded"
      >
        {/* Background */}
        <div class="absolute inset-x-0 h-1 bg-[--color-border] rounded-sm" />

        {/* Fill */}
        <div
          class="absolute left-0 h-1 bg-[--color-accent] rounded-sm transition-[width] duration-100 ease-out"
          style={{ width: `${fillPct}%` }}
        />

        {/* Snap points */}
        {values.map((v, i) => {
          const left = (i / (values.length - 1)) * 100;
          const isDefault = v === defaultValue;
          const isActive = i <= currentIndex;
          const dotSize = isDefault ? 'w-2.5 h-2.5 border-2 border-[--color-accent]' : 'w-2 h-2';
          return (
            <div
              key={v}
              class="absolute flex flex-col items-center gap-1 -translate-x-1/2"
              style={{ left: `${left}%` }}
            >
              <div
                class={`rounded-full transition-colors duration-100 ${dotSize} ${isActive ? 'bg-[--color-accent]' : 'bg-[--color-border]'}`}
              />
              <span class={`font-mono text-[0.6875rem] mt-0.5 whitespace-nowrap ${isDefault ? 'text-[--color-accent]' : 'text-[--color-text-muted]'}`}>
                {v}{isDefault ? '*' : ''}
              </span>
            </div>
          );
        })}

        {/* Thumb */}
        <div
          class="absolute w-5 h-5 rounded-full bg-[--color-accent] shadow-[0_0_8px_rgba(0,255,136,0.4)] -translate-x-1/2 z-[2] transition-[left] duration-100 ease-out"
          style={{ left: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}
