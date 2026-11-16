import { Star } from "lucide-react";
export function StarRating({ stars }: { stars: number }) {
  return (
    <span className="star-rating" aria-label={`Звёзд — ${stars} из 3`}>
      {[1, 2, 3].map((value) => (
        <Star
          key={value}
          size={17}
          aria-hidden="true"
          fill={value <= stars ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
