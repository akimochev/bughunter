import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  SquareTerminal,
} from "lucide-react";
import { assessSubmission } from "@/lib/verification/grading";
import type { SolutionCheck } from "@/lib/verification/use-solution-verifier";
import type {
  TestResult,
  VerificationProgress,
  VerificationResult,
} from "@/lib/verification/types";

interface PythonOutputProps {
  request: SolutionCheck | null;
  progress: VerificationProgress | null;
  result: VerificationResult | null;
  busy: boolean;
  codeChanged: boolean;
  buggyLine: number;
  explanation: string;
}

const statusLabels = {
  passed: "Пройден (Passed)",
  failed: "Не пройден (Failed)",
  error: "Ошибка Python",
  timeout: "Тайм-аут",
  skipped: "Пропущен",
};
const summaryLabels = {
  passed: "Все тесты пройдены",
  failed: "Есть ошибки в решении",
  error: "Проверка прервана",
  timeout: "Превышено время проверки",
  cancelled: "Проверка отменена",
};

export function PythonOutput({
  request,
  progress,
  result,
  busy,
  codeChanged,
  buggyLine,
  explanation,
}: PythonOutputProps) {
  const assessment =
    result && request?.kind === "submit"
      ? assessSubmission(request.selectedLine, buggyLine, result)
      : null;
  const accepted = assessment?.accepted === true && !codeChanged;
  const rows = result?.results ?? progress?.results ?? [];
  const passed =
    result?.passed ?? rows.filter((row) => row.status === "passed").length;
  const total = result?.total ?? request?.testCases.length ?? 0;
  let title = "Запусти публичные тесты";
  if (busy)
    title =
      progress?.phase === "running" ? "Выполнение тестов" : "Загрузка Python";
  else if (result)
    title = accepted ? "Решение принято" : summaryLabels[result.status];
  if (!busy && assessment && !accepted && result?.status === "passed")
    title = codeChanged
      ? "Результат предыдущей отправки"
      : "Решение пока не принято";
  const tone = busy
    ? "loading"
    : assessment && !accepted
      ? "failed"
      : (result?.status ?? "idle");
  const Icon = busy
    ? LoaderCircle
    : accepted || (result?.status === "passed" && !assessment)
      ? CheckCircle2
      : result
        ? AlertCircle
        : SquareTerminal;

  return (
    <div className="python-output" data-status={tone}>
      <div className="execution-status" role="status">
        <Icon size={18} />
        <h3>{title}</h3>
      </div>
      {!request && (
        <p>
          «Запустить код» проверяет публичные примеры. «Отправить решение»
          проверяет весь набор тестов и выбранную исходную строку.
        </p>
      )}
      {request && (
        <p>
          {request.kind === "submit"
            ? "Отправка решения"
            : "Публичная проверка"}{" "}
          · пройдено{" "}
          <strong data-testid="tests-count">
            {passed} / {total}
          </strong>
        </p>
      )}
      {busy && (
        <p>
          Тест {progress ? progress.index + 1 : 1} из {total}. На выполнение
          всего набора отведено 5 секунд, загрузка интерпретаторов учитывается
          отдельно. Проверку можно отменить.
        </p>
      )}
      {result?.errorMessage && <p role="alert">{result.errorMessage}</p>}
      {result && (
        <p className="execution-duration">
          Время выполнения — {result.durationMs} мс
        </p>
      )}
      {assessment && !assessment.accepted && !busy && !codeChanged && (
        <p className="submission-message">{assessment.message}</p>
      )}
      {accepted && (
        <div className="accepted-explanation">
          <h4>Что произошло в программе</h4>
          <p>{explanation}</p>
        </div>
      )}
      {rows
        .filter((row) => row.testCase.isPublic)
        .map((row, index) => (
          <TestRow key={row.testCase.id} row={row} index={index} />
        ))}
      {request?.kind === "submit" &&
        rows.some((row) => !row.testCase.isPublic) && (
          <section
            className="additional-tests"
            aria-label="Дополнительные тесты"
          >
            <h4>Дополнительные тесты</h4>
            {rows
              .filter((row) => !row.testCase.isPublic)
              .map((row, index) => (
                <TestRow key={row.testCase.id} row={row} index={index} />
              ))}
          </section>
        )}
      {codeChanged && (
        <p className="execution-stale">
          Код или выбранная строка изменены после начала проверки. Выполни новую
          проверку для актуального результата.
        </p>
      )}
    </div>
  );
}

function TestRow({ row, index }: { row: TestResult; index: number }) {
  const { testCase, execution, status } = row;
  return (
    <article
      className="test-result"
      data-status={status}
      data-public={testCase.isPublic}
    >
      <div className="test-result-heading">
        <h4>
          {testCase.isPublic ? "Публичный тест" : "Дополнительный тест"}{" "}
          {index + 1}
        </h4>
        <span>{statusLabels[status]}</span>
      </div>
      {testCase.isPublic && (
        <>
          <div className="execution-value">
            <span>Аргументы</span>
            <pre>{JSON.stringify(testCase.args)}</pre>
          </div>
          <div className="test-values">
            <div className="execution-value">
              <span>Ожидается</span>
              <pre>{JSON.stringify(testCase.expected)}</pre>
            </div>
            <div className="execution-value">
              <span>Получено</span>
              <pre data-testid="return-value">
                {execution?.hasReturnValue
                  ? JSON.stringify(execution.returnValue)
                  : "Результат отсутствует"}
              </pre>
            </div>
          </div>
          {execution && execution.status !== "success" && (
            <div className="execution-error" role="alert">
              <strong>{execution.errorType}</strong>
              <pre>{execution.errorMessage}</pre>
            </div>
          )}
          {execution?.stdout && (
            <div className="execution-value">
              <span>stdout</span>
              <pre data-testid="stdout">{execution.stdout}</pre>
            </div>
          )}
          {execution?.stderr && (
            <div className="execution-value">
              <span>stderr</span>
              <pre data-testid="stderr">{execution.stderr}</pre>
            </div>
          )}
        </>
      )}
      {!testCase.isPublic && execution && execution.status !== "success" && (
        <p className="muted">
          {execution.errorType} — проверь граничные случаи и завершение функции.
        </p>
      )}
      {status === "skipped" && (
        <p className="muted">
          Проверка остановлена. Этот тест не был выполнен до конца.
        </p>
      )}
    </article>
  );
}
