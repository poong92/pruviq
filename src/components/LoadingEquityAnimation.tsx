/**
 * LoadingEquityAnimation.tsx — Phase 1.5
 *
 * Replaces boring spinner with an animated equity curve
 * that draws itself in real-time while backtest runs.
 */
import { useEffect, useRef } from "preact/hooks";

// Demo equity data — realistic-looking curve
const DEMO_CURVE = [
  0, 1.2, -0.5, 2.1, 3.8, 2.9, 5.4, 4.1, 6.7, 8.2, 7.1, 9.5, 11.3, 10.1, 12.8,
  14.2, 12.5, 15.1, 17.3, 16.0, 18.5, 20.1, 19.2, 22.4, 21.0, 24.3, 23.1, 26.7,
  25.2, 28.9, 27.4, 30.1, 32.5, 31.0, 34.2, 33.1, 36.8, 35.4, 38.2, 40.1,
];

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: Record<string, any>;
  progressStep?: number;
  elapsedSec?: number;
}

export default function LoadingEquityAnimation({
  t,
  progressStep = 0,
  elapsedSec = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const len = DEMO_CURVE.length;
    const maxVal = Math.max(...DEMO_CURVE);
    const minVal = Math.min(...DEMO_CURVE);
    const range = maxVal - minVal || 1;
    const padX = 20;
    const padY = 20;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    let frame = 0;
    const totalFrames = 120; // ~2 seconds at 60fps

    const greenColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-green")
        .trim() || "#22c55e";
    const bgColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-bg-card")
        .trim() || "#1a1a2e";
    const mutedColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-text-muted")
        .trim() || "#666";

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = mutedColor + "20";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = padY + (plotH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(w - padX, y);
        ctx.stroke();
      }

      // How many points to draw based on animation progress
      const progress = Math.min(frame / totalFrames, 1);
      const pointsToDraw = Math.floor(progress * len);

      if (pointsToDraw > 1) {
        // Draw filled area
        ctx.beginPath();
        ctx.moveTo(padX, padY + plotH);
        for (let i = 0; i < pointsToDraw; i++) {
          const x = padX + (i / (len - 1)) * plotW;
          const y = padY + plotH - ((DEMO_CURVE[i] - minVal) / range) * plotH;
          ctx.lineTo(x, y);
        }
        const lastX = padX + ((pointsToDraw - 1) / (len - 1)) * plotW;
        ctx.lineTo(lastX, padY + plotH);
        ctx.closePath();
        ctx.fillStyle = greenColor + "15";
        ctx.fill();

        // Draw line
        ctx.beginPath();
        for (let i = 0; i < pointsToDraw; i++) {
          const x = padX + (i / (len - 1)) * plotW;
          const y = padY + plotH - ((DEMO_CURVE[i] - minVal) / range) * plotH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = greenColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Glow dot at tip
        const tipX = padX + ((pointsToDraw - 1) / (len - 1)) * plotW;
        const tipY =
          padY +
          plotH -
          ((DEMO_CURVE[pointsToDraw - 1] - minVal) / range) * plotH;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
        ctx.fillStyle = greenColor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
        ctx.fillStyle = greenColor + "30";
        ctx.fill();
      }

      frame++;
      if (frame > totalFrames + 30) frame = 0; // loop with pause
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const progressLabels = t.progressLabels || [
    "Preparing data...",
    "Computing indicators...",
    "Finding signals...",
    "Simulating trades...",
    "Building results...",
  ];

  return (
    <div class="flex flex-col items-center py-6">
      <canvas
        ref={canvasRef}
        class="w-full max-w-md rounded-lg"
        style={{ height: "160px" }}
      />
      <div class="mt-3 text-xs font-mono text-[--color-text-muted] flex items-center gap-2">
        <span class="spinner" />
        {progressLabels[progressStep] || progressLabels[0]}
        {elapsedSec > 0 && <span class="opacity-70">{elapsedSec}s</span>}
      </div>
    </div>
  );
}
