import type { MissionSummary } from "@/types/mission";

export type Stars = 1 | 2 | 3;
export type AchievementId =
  "first-case" | "perfect" | "unassisted" | "experienced" | "master";
export interface Reward {
  stars: Stars;
  xp: 50 | 75 | 100;
  hintsUsed: number;
  attempts: number;
}
interface EventBase {
  version: 1;
  id: string;
  missionId: number;
  createdAt: string;
}
export type ProgressEvent =
  | (EventBase & { kind: "initialize"; hintsUsed: number })
  | (EventBase & { kind: "hint"; sessionId: string; hintsUsed: number })
  | (EventBase & { kind: "replay" })
  | (EventBase & {
      kind: "submission";
      sessionId: string;
      counted: boolean;
      outcome: "accepted" | "rejected" | "cancelled" | "infrastructure";
      hintsUsed: number;
      reward: Reward | null;
    });

export interface LearningSession {
  hintsUsed: number;
  attempts: number;
  completed: boolean;
}
export interface MissionProgress {
  initialized: boolean;
  activeSessionId: string;
  sessions: Record<string, LearningSession>;
  best: (Reward & { completedAt: string }) | null;
  statistics: {
    submissions: number;
    counted: number;
    accepted: number;
    cancelled: number;
    infrastructure: number;
  };
}
export interface AwardReceipt extends Reward {
  requestId: string;
  missionId: number;
  xpDelta: number;
  newAchievements: AchievementId[];
}
export interface ProgressState {
  version: 1;
  missions: Record<number, MissionProgress>;
  achievements: Partial<Record<AchievementId, string>>;
  awards: Record<string, AwardReceipt>;
  totalXp: number;
  totalStars: number;
  completedCount: number;
}
export type StorageStatus =
  "saved" | "recovered" | "unavailable" | "unsupported";
export interface ProgressSnapshot {
  ready: boolean;
  storage: StorageStatus;
  progress: ProgressState;
}
export interface ProgressRepository {
  load(): { events: ProgressEvent[]; status: StorageStatus };
  append(event: ProgressEvent, state: ProgressState): StorageStatus;
  clear(): void;
}
export type ProgressMission = Pick<
  MissionSummary,
  "id" | "slug" | "title" | "tier"
>;
