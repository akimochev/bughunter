import { Star } from "lucide-react";
import type { CSSProperties } from "react";
export function StarReveal({
  stars,
  animate,
}: {
  stars: number;
  animate: boolean;
}) {
  return (
    <div className="reward-stars" aria-label={`Получено звёзд: ${stars} из 3`}>
      {[1, 2, 3].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          size={34}
          fill={value <= stars ? "currentColor" : "none"}
          className={`${value <= stars ? "star-earned" : "star-empty"}${animate && value <= stars ? " star-reveal" : ""}`}
          style={{ "--star-delay": `${(value - 1) * 160}ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}
