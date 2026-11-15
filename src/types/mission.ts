export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type MissionTier = "beginner" | "intermediate" | "advanced";

export interface TestCase {
  id: string;
  args: JsonValue[];
  expected: JsonValue;
  isPublic: boolean;
}

export interface TraceStep {
  line: number;
  variables: Record<string, JsonValue>;
  note: string;
}

export interface MissionContent {
  story: string;
  goal: string;
  expectedBehavior: string;
  constraints: string[];
  starterCode: string;
  buggyLine: number;
  referenceSolution: string;
  publicTests: TestCase[];
  hiddenTests: TestCase[];
  hints: [string, string, string];
  theory: string;
  explanation: string;
  trace?: { inputLabel: string; steps: TraceStep[] };
}

export interface MissionSummary {
  id: number;
  slug: string;
  title: string;
  tier: MissionTier;
  description: string;
  topic: string;
  functionName: string;
}

// A draft cannot accidentally be treated as a runnable, fully authored mission.
export type ReadyMission = MissionSummary & {
  contentStatus: "ready";
  content: MissionContent;
};

export type Mission = MissionSummary &
  (
    | { contentStatus: "draft"; content: null }
    | { contentStatus: "ready"; content: MissionContent }
  );

// Only learner-facing data crosses the server/client boundary.
export type LearnerMission = MissionSummary & {
  content: Pick<
    MissionContent,
    | "story"
    | "goal"
    | "expectedBehavior"
    | "constraints"
    | "starterCode"
    | "publicTests"
    | "hints"
    | "theory"
  >;
};
