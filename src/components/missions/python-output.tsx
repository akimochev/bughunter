import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  SquareTerminal,
} from "lucide-react";
import type { PythonRunRequest, PythonRunResult } from "@/lib/python/types";

interface PythonOutputProps {
  phase: "idle" | "loading" | "running" | "finished";
  request: PythonRunRequest | null;
  result: PythonRunResult | null;
  codeChanged: boolean;
}

const explanations: Record<string, string> = {
  SyntaxError: "Проверь синтаксис, двоеточия и скобки.",
  IndentationError: "Проверь отступы внутри функции и блоков.",
  NameError: "Проверь имена функции и переменных.",
  TypeError: "Проверь типы данных и аргументы функции.",
  ZeroDivisionError: "В программе возникло деление на ноль.",
  IndexError: "Программа обратилась к элементу за границами списка.",
  OSError:
    "Проверь операции ввода. Интерактивный input() в этом тренажёре недоступен.",
};

export function PythonOutput({
  phase,
  request,
  result,
  codeChanged,
}: PythonOutputProps) {
  const title =
    phase === "loading"
      ? "Загрузка Python"
      : phase === "running"
        ? "Выполнение"
        : result?.status === "success"
          ? "Успешное выполнение"
          : result?.status === "timeout"
            ? "Превышено время выполнения"
            : result?.errorType === "CancelledError"
              ? "Запуск отменён"
              : result
                ? "Ошибка"
                : "Запусти код на первом примере";
  const Icon =
    phase === "loading" || phase === "running"
      ? LoaderCircle
      : result?.status === "success"
        ? CheckCircle2
        : result?.status === "timeout"
          ? Clock3
          : result
            ? AlertCircle
            : SquareTerminal;

  return (
    <div className="python-output" data-status={result?.status ?? phase}>
      <div className="execution-status" role="status">
        <Icon size={18} />
        <h3>{title}</h3>
      </div>
      {phase === "idle" && (
        <p>Выполнится текущий черновик с аргументами первого примера.</p>
      )}
      {phase === "loading" && (
        <p>
          Интерпретатор загружается в отдельный Worker. Время загрузки зависит
          от соединения. Запуск можно отменить.
        </p>
      )}
      {phase === "running" && (
        <p>
          Лимит выполнения — 5 секунд. Можно продолжать работать с интерфейсом
          или отменить запуск.
        </p>
      )}
      {request && (
        <div className="execution-value">
          <span>Аргументы функции {request.functionName} · первый пример</span>
          <pre>{JSON.stringify(request.args)}</pre>
        </div>
      )}
      {result && (
        <>
          <p className="execution-duration">
            Время выполнения — {result.durationMs} мс
          </p>
          {result.hasReturnValue && (
            <div className="execution-value">
              <span>Возвращённое значение</span>
              <pre data-testid="return-value">
                {result.returnValue === null
                  ? "None (null)"
                  : JSON.stringify(result.returnValue)}
              </pre>
            </div>
          )}
          {result.status === "success" ? (
            <p>
              Функция выполнена. Правильность решения будет проверяться на
              следующем этапе.
            </p>
          ) : (
            <div className="execution-error" role="alert">
              <strong>{result.errorType}</strong>
              <p>{explanations[result.errorType]}</p>
              <pre>{result.errorMessage}</pre>
            </div>
          )}
          {result.stdout && (
            <div className="execution-value">
              <span>Стандартный вывод · stdout</span>
              <pre data-testid="stdout">{result.stdout}</pre>
            </div>
          )}
          {result.stderr && (
            <div className="execution-value">
              <span>Вывод ошибок · stderr</span>
              <pre data-testid="stderr">{result.stderr}</pre>
            </div>
          )}
        </>
      )}
      {codeChanged && (
        <p className="execution-stale">
          Код изменён после начала запуска. Запусти снова для актуального
          результата.
        </p>
      )}
    </div>
  );
}
