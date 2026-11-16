"use client";

import dynamic from "next/dynamic";
import {
  Bug,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Square,
} from "lucide-react";
import { usePythonTrace } from "@/lib/trace/use-python-trace";
import { describeStep, variableChanges } from "@/lib/trace/playback";
import type { TestCase } from "@/types/mission";

const PythonEditor = dynamic(
  () => import("@/components/editor/python-editor"),
  {
    ssr: false,
    loading: () => <p className="editor-loading">Загружаем просмотр кода…</p>,
  },
);

export function DebugPanel({
  code,
  functionName,
  testCase,
  disabled,
}: {
  code: string;
  functionName: string;
  testCase: TestCase;
  disabled: boolean;
}) {
  const trace = usePythonTrace();
  const { request, result, index } = trace;
  const step = result?.steps[index];
  const changes = result ? variableChanges(result.steps, index) : {};
  const stale = request !== null && request.sourceCode !== code;
  const atEnd =
    result !== null &&
    (result.steps.length === 0 || index === result.steps.length - 1);
  const title =
    result?.status === "completed"
      ? atEnd
        ? "Выполнение завершено"
        : "Трасса записана"
      : result?.status === "limited"
        ? "Достигнут лимит трассы"
        : result?.status === "timeout"
          ? "Время отладки истекло"
          : result?.status === "cancelled"
            ? "Отладка остановлена"
            : "Ошибка выполнения";

  return (
    <section className="panel debug-panel" aria-labelledby="debug-heading">
      <div className="panel-title">
        <Bug size={18} />
        <h2 id="debug-heading">Пошаговая отладка</h2>
      </div>
      <div className="debug-body">
        <p className="muted">
          Запись реального выполнения твоего черновика на первом публичном
          примере:{" "}
          <code>
            {functionName}(
            {testCase.args.map((value) => JSON.stringify(value)).join(", ")})
          </code>
          . Затем можно просмотреть шаги. Это отдельный запуск, он не проверяет
          решение и не меняет XP.
        </p>
        <div className="debug-actions">
          <button
            className="button button-secondary"
            disabled={disabled || trace.busy}
            onClick={() =>
              trace.run({
                requestId: crypto.randomUUID(),
                sourceCode: code,
                functionName,
                args: structuredClone(testCase.args),
              })
            }
          >
            <Bug size={16} />
            Отладка
          </button>
          {trace.busy && (
            <button className="button button-secondary" onClick={trace.cancel}>
              <Square size={15} />
              Остановить отладку
            </button>
          )}
        </div>
        {trace.busy && (
          <p role="status">
            {trace.phase === "loading"
              ? "Загружаем Python для отладки…"
              : "Записываем трассу выполнения…"}
          </p>
        )}
        {stale && (
          <p className="debug-warning" role="status">
            Трасса устарела: код изменён. Ниже показан сохранённый код этого
            запуска. Нажми «Отладка», чтобы записать новую трассу.
          </p>
        )}
        {result && (
          <>
            <div
              className={`debug-outcome${result.status === "completed" ? " debug-completed" : ""}`}
              role="status"
            >
              <h3>{title}</h3>
              {result.returnValue && atEnd && (
                <p>
                  Возвращённый результат:{" "}
                  <code data-testid="debug-result">
                    {result.returnValue.display}
                  </code>{" "}
                  <span className="muted">({result.returnValue.type})</span>
                </p>
              )}
              {result.error && (
                <p>
                  <strong>{result.error.type}</strong>: {result.error.message}
                  {result.error.lineNumber
                    ? ` · строка ${result.error.lineNumber}`
                    : ""}
                </p>
              )}
              {result.steps.length === 0 && (
                <p>
                  Шаги не записаны.
                  {result.error?.type === "SyntaxError"
                    ? " Сначала исправь синтаксис кода."
                    : " Можно повторить запуск."}
                </p>
              )}
            </div>
            {step && (
              <>
                <nav className="debug-navigation" aria-label="Шаги отладки">
                  <button
                    className="button button-secondary"
                    disabled={index === 0}
                    onClick={() => trace.select(index - 1)}
                  >
                    <ChevronLeft size={16} />
                    Назад
                  </button>
                  <span data-testid="debug-step-count" aria-live="polite">
                    Шаг {index + 1} из {result.steps.length}
                  </span>
                  <button
                    className="button button-secondary"
                    disabled={index === result.steps.length - 1}
                    onClick={() => trace.select(index + 1)}
                  >
                    Следующий шаг
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={index === 0}
                    onClick={() => trace.select(0)}
                  >
                    <RotateCcw size={15} />
                    Сначала
                  </button>
                </nav>
                <p className="debug-event" data-testid="debug-event">
                  {describeStep(step)}
                </p>
                <p className="muted">
                  Событие <code>{step.eventType}</code> ·{" "}
                  <code>{step.functionName}</code> · глубина стека{" "}
                  {step.stackDepth} · строка {step.lineNumber || "—"}
                </p>
              </>
            )}
            <div className="debug-code">
              <PythonEditor
                code={request!.sourceCode}
                readOnly
                traceLine={step?.lineNumber ?? result.error?.lineNumber ?? null}
                label="Сохранённый Python-код отладки"
              />
            </div>
            {step && (
              <>
                <p className="debug-legend">
                  Голубым отмечена строка отладки. Фиолетовая гипотеза в
                  исходном коде остаётся отдельной. Выделены новые и изменённые
                  видимые значения в текущем вызове функции.
                </p>
                <div className="debug-table-scroll">
                  <table className="debug-variables">
                    <caption>Локальные переменные</caption>
                    <thead>
                      <tr>
                        <th scope="col">Переменная</th>
                        <th scope="col">Тип</th>
                        <th scope="col">Значение</th>
                        <th scope="col">Изменение</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(step.variables).map(([name, value]) => (
                        <tr
                          key={name}
                          data-variable={name}
                          className={
                            changes[name] ? "debug-variable-changed" : ""
                          }
                        >
                          <th scope="row">
                            <code>{name}</code>
                          </th>
                          <td>{value.type}</td>
                          <td>
                            <code>{value.display}</code>
                            {value.truncated && (
                              <span className="debug-truncated">
                                {" "}
                                · представление ограничено
                              </span>
                            )}
                          </td>
                          <td>
                            {changes[name] === "new"
                              ? "Появилась"
                              : changes[name] === "changed"
                                ? "Изменилось"
                                : "—"}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(step.variables).length === 0 && (
                        <tr>
                          <td colSpan={4}>Локальных переменных пока нет.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {step.variablesTruncated && (
                  <p className="muted">
                    Показаны первые 20 локальных переменных.
                  </p>
                )}
                {step.returnValue && (
                  <p>
                    Этот вызов возвращает:{" "}
                    <code>{step.returnValue.display}</code>.
                  </p>
                )}
                {step.error && (
                  <p className="debug-warning">
                    <strong>{step.error.type}</strong>: {step.error.message}
                  </p>
                )}
              </>
            )}
            {(result.stdout || result.stderr) && (
              <details className="debug-output">
                <summary>Вывод программы</summary>
                {result.stdout && <pre>{result.stdout}</pre>}
                {result.stderr && <pre>{result.stderr}</pre>}
              </details>
            )}
          </>
        )}
        <p className="debug-limits">
          До 300 шагов, 5 секунд исполнения и 512 КиБ трассы. Значения
          сокращаются. Загрузка Python учитывается отдельно. Worker не является
          защищённой песочницей.
        </p>
      </div>
    </section>
  );
}
