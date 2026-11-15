import { describe, expect, it } from "vitest";
import {
  createDraft,
  createDraftStore,
  draftKey,
  MAX_CODE_LENGTH,
  parseDraft,
} from "@/lib/mission-draft";
import {
  isBuggyLine,
  isValidLine,
  lineSelectionFeedback,
} from "@/lib/line-selection";

const source = "def sample():\n    return 1";

describe("состояние миссии", () => {
  it("восстанавливает безопасное состояние при повреждении или смене исходника", () => {
    for (const value of [
      null,
      "broken",
      "null",
      "[]",
      "{}",
      JSON.stringify({ ...createDraft(source), version: 99 }),
      JSON.stringify({ ...createDraft(source), source: "old" }),
      JSON.stringify({
        ...createDraft(source),
        code: "a".repeat(MAX_CODE_LENGTH + 1),
      }),
    ])
      expect(parseDraft(value, source)).toEqual(createDraft(source));
  });

  it("нормализует некорректную строку и число подсказок", () => {
    const value = parseDraft(
      JSON.stringify({
        ...createDraft(source),
        selectedLine: 999,
        hintsUsed: -1,
      }),
      source,
    );
    expect(value.selectedLine).toBeNull();
    expect(value.hintsUsed).toBe(0);
  });

  it("сохраняет черновик, исходную строку и подсказки отдельно по slug", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const first = createDraftStore("first", source, () => storage);
    first.getSnapshot();
    first.update({ code: "", selectedLine: 2, hintsUsed: 2 });
    const restored = createDraftStore("first", source, () => storage);
    expect(restored.getSnapshot().draft).toMatchObject({
      code: "",
      selectedLine: 2,
      hintsUsed: 2,
    });
    const second = createDraftStore("second", source, () => storage);
    expect(second.getSnapshot().draft).toEqual(createDraft(source));
    restored.update({ code: source });
    expect(restored.getSnapshot().draft).toMatchObject({
      selectedLine: 2,
      hintsUsed: 2,
    });
    expect(draftKey("first")).not.toBe(draftKey("second"));
  });

  it("сохраняет работу в памяти при запрете localStorage", () => {
    const store = createDraftStore("first", source, () => {
      throw new Error("blocked");
    });
    expect(store.getSnapshot().storage).toBe("unavailable");
    expect(() => store.update({ code: "edited" })).not.toThrow();
    expect(store.getSnapshot().draft.code).toBe("edited");
  });

  it("обрабатывает переполнение хранилища и уведомляет подписчиков", () => {
    const store = createDraftStore("first", source, () => ({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    }));
    store.getSnapshot();
    let changes = 0;
    const unsubscribe = store.subscribe(() => {
      changes++;
    });
    store.update({ hintsUsed: 1 });
    expect(store.getSnapshot().storage).toBe("unavailable");
    expect(store.getSnapshot().draft.hintsUsed).toBe(1);
    expect(changes).toBe(1);
    unsubscribe();
    store.update({ hintsUsed: 2 });
    expect(changes).toBe(1);
  });
});

describe("выбор исходной строки", () => {
  it("проверяет границы и отделяет гипотезу от её правильности", () => {
    expect(isValidLine(2, source)).toBe(true);
    for (const line of [null, 0, -1, 1.5, 3])
      expect(isValidLine(line, source)).toBe(false);
    expect(isBuggyLine(null, 2)).toBe(false);
    expect(isBuggyLine(1, 2)).toBe(false);
    expect(isBuggyLine(2, 2)).toBe(true);
    expect(lineSelectionFeedback(2, source)).toContain("Выбрана строка 2");
    expect(lineSelectionFeedback(2, source)).not.toContain("правильно");
  });
});
