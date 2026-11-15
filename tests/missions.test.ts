import { describe, expect, it } from "vitest";
import { missions, toLearnerMission } from "@/content/missions";

describe("контракт миссий", () => {
  it("содержит восемь уникальных миссий с возрастающей сложностью", () => {
    expect(missions).toHaveLength(8);
    expect(new Set(missions.map((mission) => mission.id)).size).toBe(8);
    expect(new Set(missions.map((mission) => mission.slug)).size).toBe(8);
    expect(missions.map((mission) => mission.tier)).toEqual([
      "beginner",
      "beginner",
      "beginner",
      "intermediate",
      "intermediate",
      "intermediate",
      "advanced",
      "advanced",
    ]);
  });

  for (const mission of missions) {
    it(`${mission.id}. ${mission.title} — полные данные и одна ошибочная строка`, () => {
      const { content } = mission;
      expect(mission.slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(content.hints).toHaveLength(3);
      expect(new Set(content.hints).size).toBe(3);
      expect(content.publicTests.length).toBeGreaterThanOrEqual(2);
      expect(content.publicTests.length).toBeLessThanOrEqual(3);
      expect(content.hiddenTests.length).toBeGreaterThanOrEqual(3);
      expect(content.hiddenTests.length).toBeLessThanOrEqual(5);
      expect(content.publicTests.every((test) => test.isPublic)).toBe(true);
      expect(content.hiddenTests.every((test) => !test.isPublic)).toBe(true);
      const tests = [...content.publicTests, ...content.hiddenTests];
      expect(new Set(tests.map((test) => test.id)).size).toBe(tests.length);
      expect(content.constraints.length).toBeGreaterThan(0);
      for (const text of [
        mission.title,
        content.story,
        content.goal,
        content.expectedBehavior,
        content.theory,
        content.explanation,
        ...content.hints,
      ])
        expect(text.trim().length).toBeGreaterThan(10);
      const source = content.starterCode.split("\n");
      const reference = content.referenceSolution.split("\n");
      expect(Number.isInteger(content.buggyLine)).toBe(true);
      expect(content.buggyLine).toBeGreaterThan(0);
      expect(content.buggyLine).toBeLessThanOrEqual(source.length);
      expect(source).toHaveLength(reference.length);
      expect(
        source.flatMap((line, index) =>
          line === reference[index] ? [] : [index + 1],
        ),
      ).toEqual([content.buggyLine]);
      expect(source[0]).toContain(`def ${mission.functionName}(`);
    });
  }

  it("не передаёт авторские ответы и дополнительные тесты в интерфейс", () => {
    for (const mission of missions) {
      const learner = toLearnerMission(mission);
      for (const key of [
        "referenceSolution",
        "buggyLine",
        "hiddenTests",
        "explanation",
      ])
        expect(learner.content).not.toHaveProperty(key);
      expect(learner.content.publicTests).toEqual(mission.content.publicTests);
    }
  });
});
