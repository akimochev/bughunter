import type { MissionTier } from "@/types/mission";

export const tiers: Record<
  MissionTier,
  { label: string; description: string }
> = {
  beginner: {
    label: "Новичок",
    description: "Замечай детали. Познакомься с условиями и циклами.",
  },
  intermediate: {
    label: "Практик",
    description: "Проверяй предположения и находи неочевидные случаи.",
  },
  advanced: {
    label: "Детектив",
    description: "Следи за границами и распутывай алгоритмы.",
  },
};
