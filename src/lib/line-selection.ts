export function isValidLine(
  line: number | null,
  source: string,
): line is number {
  return (
    line !== null &&
    Number.isInteger(line) &&
    line >= 1 &&
    line <= source.split("\n").length
  );
}

// Correctness is evaluated separately when a solution can actually be submitted.
export function isBuggyLine(
  selectedLine: number | null,
  buggyLine: number,
): boolean {
  return selectedLine === buggyLine;
}

export function lineSelectionFeedback(
  line: number | null,
  source: string,
): string {
  if (!isValidLine(line, source))
    return "Выбери подозрительную строку исходного кода.";
  return `Выбрана строка ${line} исходного кода. Проверка гипотезы станет доступна вместе с отправкой решения.`;
}
