"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Code2,
  FileCode2,
  FlaskConical,
  Lightbulb,
  Play,
  RotateCcw,
  Send,
  Target,
  Square,
} from "lucide-react";
import { createDraftStore, MAX_CODE_LENGTH } from "@/lib/mission-draft";
import { lineSelectionFeedback } from "@/lib/line-selection";
import type { JsonValue, LearnerMission } from "@/types/mission";
import { usePythonRunner } from "@/lib/python/use-python-runner";
import { PythonOutput } from "./python-output";

const PythonEditor = dynamic(
  () => import("@/components/editor/python-editor"),
  {
    ssr: false,
    loading: () => (
      <p className="editor-loading">
        Загружаем редактор… Доступен также простой режим.
      </p>
    ),
  },
);

export function MissionWorkspace({ mission }: { mission: LearnerMission }) {
  const { content } = mission;
  const store = useMemo(
    () =>
      createDraftStore(
        mission.slug,
        content.starterCode,
        () => window.localStorage,
      ),
    [mission.slug, content.starterCode],
  );
  const { draft, storage } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [mode, setMode] = useState<"source" | "edit">("source");
  const [simpleEditor, setSimpleEditor] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const sourceLines = content.starterCode.split("\n");
  const execution = usePythonRunner();
  const firstExample = content.publicTests[0];

  return (
    <div className="workspace-grid">
      <aside className="mission-brief panel">
        <details className="brief-details" open>
          <summary className="panel-title">
            <Target size={18} />
            Материалы дела
          </summary>
          <div className="brief-body">
            <p className="eyebrow">ИСТОРИЯ</p>
            <p>{content.story}</p>
            <div className="brief-divider" />
            <h3>Твоя задача</h3>
            <p>{content.goal}</p>
            <div className="function-label">
              <Code2 size={16} />
              <code>{mission.functionName}()</code>
            </div>
            <h3 className="brief-subheading">Ожидаемое поведение</h3>
            <p>{content.expectedBehavior}</p>
            <ul className="mission-constraints">
              {content.constraints.map((constraint) => (
                <li key={constraint}>{constraint}</li>
              ))}
            </ul>
            <h3 className="brief-subheading">Примеры</h3>
            <div className="mission-examples">
              {content.publicTests.map((test, index) => (
                <div key={test.id}>
                  <span>Пример {index + 1}</span>
                  <code>
                    {mission.functionName}(
                    {test.args.map((arg) => formatPython(arg)).join(", ")})
                  </code>
                  <code className="expected-result">
                    → {formatPython(test.expected)}
                  </code>
                </div>
              ))}
            </div>
            <div className="brief-divider" />
            <h3>Мини-теория</h3>
            <p>{content.theory}</p>
          </div>
        </details>
        <section className="hints-section" aria-labelledby="hints-heading">
          <h3 id="hints-heading">
            <Lightbulb size={16} />
            Подсказки <span>{draft.hintsUsed} / 3</span>
          </h3>
          <p className="hint-intro">
            Открывай по одной, если зашёл в тупик. Использование сохраняется.
          </p>
          <div aria-live="polite">
            {content.hints.slice(0, draft.hintsUsed).map((hint, index) => (
              <div className="hint-card" key={hint}>
                <strong>Подсказка {index + 1}</strong>
                <p>{hint}</p>
              </div>
            ))}
          </div>
          <button
            className="button button-secondary"
            disabled={storage === "pending" || draft.hintsUsed === 3}
            onClick={() => store.update({ hintsUsed: draft.hintsUsed + 1 })}
          >
            {draft.hintsUsed === 3
              ? "Все подсказки открыты"
              : `Открыть подсказку ${draft.hintsUsed + 1}`}
          </button>
        </section>
      </aside>
      <div className="workspace-right">
        <section className="panel editor-panel" aria-labelledby="editor-title">
          <div className="panel-title">
            <FileCode2 size={18} />
            <h2 id="editor-title">Исследование кода</h2>
            <span className="panel-label">Python</span>
          </div>
          <div
            className="editor-mode-controls"
            role="group"
            aria-label="Режим работы с кодом"
          >
            <button
              aria-pressed={mode === "source"}
              onClick={() => setMode("source")}
            >
              1. Найди строку
            </button>
            <button
              aria-pressed={mode === "edit"}
              onClick={() => setMode("edit")}
            >
              2. Исправь код
            </button>
          </div>
          <div className="line-selection-control">
            <label htmlFor="suspect-line">
              Подозрительная строка исходного кода
            </label>
            <select
              id="suspect-line"
              value={draft.selectedLine ?? ""}
              disabled={storage === "pending"}
              onChange={(event) =>
                store.update({
                  selectedLine: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            >
              <option value="">Выбрать строку</option>
              {sourceLines.map((line, index) => (
                <option key={index} value={index + 1}>
                  {index + 1}. {line.trim() || "(пустая строка)"}
                </option>
              ))}
            </select>
            <p className="selection-feedback" role="status">
              {lineSelectionFeedback(draft.selectedLine, content.starterCode)}
            </p>
          </div>
          <div className="editor-tools">
            <span>
              {mode === "source"
                ? "Исходный код · нажми на строку или её номер"
                : "Твой черновик · Tab — отступ, Esc затем Tab — выход"}
            </span>
            <button
              onClick={() => setSimpleEditor(!simpleEditor)}
              aria-pressed={simpleEditor}
            >
              {simpleEditor ? "Подсветка синтаксиса" : "Простой режим"}
            </button>
          </div>
          {storage === "pending" ? (
            <p className="editor-loading">Восстанавливаем черновик…</p>
          ) : simpleEditor ? (
            mode === "source" ? (
              <div
                className="source-lines"
                aria-label="Выбор строки исходного кода"
              >
                {sourceLines.map((line, index) => (
                  <button
                    key={index}
                    aria-pressed={draft.selectedLine === index + 1}
                    onClick={() => store.update({ selectedLine: index + 1 })}
                  >
                    <span>{index + 1}</span>
                    <code>{line || " "}</code>
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                className="simple-python-editor"
                aria-label="Простой редактор исправления Python"
                value={draft.code}
                onChange={(event) => store.update({ code: event.target.value })}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                maxLength={MAX_CODE_LENGTH}
                wrap="off"
              />
            )
          ) : (
            <PythonEditor
              key={mode}
              code={mode === "source" ? content.starterCode : draft.code}
              readOnly={mode === "source"}
              selectedOriginalLine={draft.selectedLine}
              onSelectLine={(line) => store.update({ selectedLine: line })}
              onChange={
                mode === "edit" ? (code) => store.update({ code }) : undefined
              }
            />
          )}
          <div className="draft-toolbar">
            <span role="status">
              {storage === "pending"
                ? "Загрузка черновика…"
                : storage === "unavailable"
                  ? "Сохранение недоступно. Черновик останется до ухода со страницы."
                  : "Черновик сохраняется на этом устройстве"}
            </span>
            <button
              className="text-link"
              disabled={
                storage === "pending" || draft.code === content.starterCode
              }
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw size={14} />
              Восстановить код
            </button>
          </div>
          {confirmReset && (
            <div
              className="reset-confirmation"
              role="group"
              aria-label="Подтверждение восстановления кода"
            >
              <p>
                Восстановить исходный код? Изменения в черновике будут удалены.
                Выбранная строка и открытые подсказки сохранятся.
              </p>
              <button
                className="button button-secondary"
                onClick={() => {
                  store.update({ code: content.starterCode });
                  setConfirmReset(false);
                }}
              >
                Восстановить
              </button>
              <button
                className="button button-secondary"
                onClick={() => setConfirmReset(false)}
              >
                Отмена
              </button>
            </div>
          )}
          <div className="editor-actions">
            <button
              className="button button-secondary"
              disabled={
                storage === "pending" || execution.busy || !firstExample
              }
              aria-describedby="runner-notice"
              onClick={() => {
                setMode("edit");
                execution.run({
                  requestId: crypto.randomUUID(),
                  sourceCode: draft.code,
                  functionName: mission.functionName,
                  args: firstExample.args,
                });
              }}
            >
              <Play size={16} />
              Запустить код
            </button>
            {execution.busy && (
              <button
                className="button button-secondary"
                onClick={execution.cancel}
              >
                <Square size={15} />
                Отменить запуск
              </button>
            )}
            <button
              className="button button-primary"
              disabled
              aria-describedby="runner-notice"
            >
              <Send size={16} />
              Отправить решение
            </button>
          </div>
          <p id="runner-notice" className="runner-notice">
            Запуск использует текущий черновик и первый пример. Автоматическая
            проверка решения появится на следующем этапе.
          </p>
        </section>
        <section className="panel results-panel">
          <div className="panel-title">
            <FlaskConical size={18} />
            <h2>Результат запуска</h2>
          </div>
          <PythonOutput
            phase={execution.phase}
            request={execution.request}
            result={execution.result}
            codeChanged={
              execution.request !== null &&
              execution.request.sourceCode !== draft.code
            }
          />
        </section>
      </div>
    </div>
  );
}

function formatPython(value: JsonValue): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return `[${value.map(formatPython).join(", ")}]`;
  if (typeof value === "object")
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${formatPython(item)}`)
      .join(", ")}}`;
  return JSON.stringify(value);
}
