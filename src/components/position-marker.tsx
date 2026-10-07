import { MAP_HEIGHT, MAP_WIDTH } from "@/data/resort";

type Props = { x: number; y: number; radius: number };

/**
 * «Я тут»: синя точка з білою обводкою й коло похибки.
 * Точка має сталий розмір на екрані (масштаб 1/--zoom), коло похибки — реальний розмір у метрах.
 */
export function PositionMarker({ x, y, radius }: Props) {
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      className="pointer-events-none absolute inset-0 max-w-none"
      aria-hidden="true"
    >
      <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
        <circle r={Math.max(radius, 6)} fill="rgb(37 99 235 / 0.16)" stroke="rgb(37 99 235 / 0.5)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <g style={{ transform: "scale(calc(1 / var(--zoom)))" }}>
          <circle r="10" fill="#fff" />
          <circle r="7" fill="#2563eb" />
        </g>
      </g>
    </svg>
  );
}
