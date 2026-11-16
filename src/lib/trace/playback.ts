import type { TraceStep } from "./types";

export function variableChanges(
  steps: TraceStep[],
  index: number,
): Record<string, "new" | "changed"> {
  const step = steps[index];
  const changes: Record<string, "new" | "changed"> = Object.create(null);
  if (!step) return changes;
  let previous: TraceStep | undefined;
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    if (steps[cursor].frameId === step.frameId) {
      previous = steps[cursor];
      break;
    }
  }
  for (const [name, value] of Object.entries(step.variables)) {
    const before =
      previous && Object.hasOwn(previous.variables, name)
        ? previous.variables[name]
        : undefined;
    if (!before) changes[name] = "new";
    else if (
      value.type !== before.type ||
      value.display !== before.display ||
      value.truncated !== before.truncated
    )
      changes[name] = "changed";
  }
  return changes;
}

export function describeStep(step: TraceStep): string {
  if (step.eventType === "line")
    return `Перед выполнением строки ${step.lineNumber}. Переменные ещё не отражают выполнение этой строки.`;
  if (step.eventType === "call")
    return `Вход в ${step.functionName === "<module>" ? "модуль" : `функцию ${step.functionName}`}. Аргументы уже переданы.`;
  if (step.eventType === "exception")
    return "Возникло исключение. Оно может быть обработано следующими строками программы.";
  if (step.error)
    return "Выход из функции из-за исключения. Возвращаемого значения нет.";
  return step.returnValue
    ? "Возврат из функции. Выражение возвращаемого значения уже вычислено."
    : "Выход из текущего кадра выполнения.";
}
