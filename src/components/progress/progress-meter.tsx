import type { CSSProperties } from "react";
export function ProgressMeter({
  value,
  max,
  label,
  from = value,
  animate = false,
}: {
  value: number;
  max: number;
  label: string;
  from?: number;
  animate?: boolean;
}) {
  const ratio = Math.max(0, Math.min(1, value / Math.max(1, max)));
  return (
    <div
      className="progress-meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span
        className={animate ? "progress-meter-reveal" : undefined}
        style={
          {
            transform: `scaleX(${ratio})`,
            "--progress-from": Math.max(
              0,
              Math.min(1, from / Math.max(1, max)),
            ),
            "--progress-to": ratio,
          } as CSSProperties
        }
      />
    </div>
  );
}
