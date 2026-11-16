"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
import { isValidLine, lineSelectionFeedback } from "@/lib/line-selection";
import type { JsonValue, LearnerMission } from "@/types/mission";
import { useSolutionVerifier } from "@/lib/verification/use-solution-verifier";
import type { CheckKind } from "@/lib/verification/types";
import { PythonOutput } from "./python-output";
import { useProgress } from "@/components/progress/progress-provider";
import { currentSession, isMissionUnlocked } from "@/lib/progress/rules";
import { MissionSuccess } from "@/components/progress/mission-success";

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
  const [confirmReplay, setConfirmReplay] = useState(false);
  const {
    store: progressStore,
    ready: progressReady,
    progress,
    missions,
  } = useProgress();
  const missionProgress = progress.missions[mission.id];
  const session = currentSession(missionProgress);
  const sessionReady = progressReady && missionProgress?.initialized === true;
  const hintsUsed = sessionReady ? session.hintsUsed : draft.hintsUsed;
  useEffect(() => {
    if (storage !== "pending")
      progressStore.initialize(mission.id, draft.hintsUsed);
  }, [storage, progressStore, mission.id, draft.hintsUsed]);
  const sourceLines = content.starterCode.split("\n");
  const execution = useSolutionVerifier();
  const selectionValid = isValidLine(draft.selectedLine, content.starterCode);

  function checkSolution(kind: CheckKind) {
    if (
      execution.busy ||
      !sessionReady ||
      !isMissionUnlocked(mission, progress, missions) ||
      storage === "pending" ||
      (kind === "submit" && !selectionValid)
    )
      return;
    const check = {
      requestId: crypto.randomUUID(),
      sourceCode: draft.code,
      functionName: mission.functionName,
      testCases:
        kind === "run"
          ? content.publicTests
          : [...content.publicTests, ...mission.verification.hiddenTests],
      kind,
      selectedLine: kind === "submit" ? draft.selectedLine : null,
    };
    const sessionId = missionProgress?.activeSessionId ?? "initial";
    const started = execution.check(check, (result) =>
      progressStore.recordOutcome(
        mission.id,
        sessionId,
        hintsUsed,
        check,
        result,
        mission.verification.buggyLine,
      ),
    );
    if (started && kind === "submit") store.recordSubmission();
    if (started) setMode("edit");
  }

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
            Подсказки <span>{hintsUsed} / 3</span>
          </h3>
          <p className="hint-intro">
            Открывай по одной, если зашёл в тупик. Использование сохраняется.
          </p>
          <div aria-live="polite">
            {content.hints.slice(0, hintsUsed).map((hint, index) => (
              <div className="hint-card" key={hint}>
                <strong>Подсказка {index + 1}</strong>
                <p>{hint}</p>
              </div>
            ))}
          </div>
          <button
            className="button button-secondary"
            disabled={!sessionReady || hintsUsed === 3}
            onClick={() => progressStore.openHint(mission.id)}
          >
            {hintsUsed === 3
              ? "Все подсказки открыты"
              : `Открыть подсказку ${hintsUsed + 1}`}
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
                Выбранная строка, подсказки и учитываемые отправки сохранятся.
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
                storage === "pending" || execution.busy || !sessionReady
              }
              aria-describedby="runner-notice"
              onClick={() => checkSolution("run")}
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
              disabled={
                storage === "pending" ||
                execution.busy ||
                !selectionValid ||
                !sessionReady
              }
              aria-describedby="runner-notice"
              onClick={() => checkSolution("submit")}
            >
              <Send size={16} />
              Отправить решение
            </button>
          </div>
          <p id="runner-notice" className="runner-notice">
            Запуск проверяет публичные тесты. Для отправки выбери исходную
            строку — проверятся также дополнительные тесты. Отправок —{" "}
            <span data-testid="submit-attempts">{draft.submitAttempts}</span>.{" "}
            Для награды учтено —{" "}
            <span data-testid="reward-attempts">{session.attempts}</span>.
          </p>
          {session.completed && (
            <div className="replay-controls">
              <p>
                Для улучшения результата начни новое прохождение. Черновик и
                лучший результат сохранятся, подсказки и учитываемые отправки
                начнутся с нуля.
              </p>
              <button
                className="button button-secondary"
                disabled={execution.busy}
                onClick={() => setConfirmReplay(true)}
              >
                Пройти заново
              </button>
            </div>
          )}
          {confirmReplay && (
            <div
              className="reset-confirmation"
              role="group"
              aria-label="Новое прохождение"
            >
              <p>
                Начать новое прохождение с нулём подсказок и учитываемых
                отправок?
              </p>
              <button
                className="button button-secondary"
                onClick={() => {
                  if (progressStore.startReplay(mission.id)) execution.reset();
                  setConfirmReplay(false);
                }}
              >
                Начать прохождение
              </button>
              <button
                className="button button-secondary"
                onClick={() => setConfirmReplay(false)}
              >
                Отмена
              </button>
            </div>
          )}
        </section>
        <section className="panel results-panel">
          <div className="panel-title">
            <FlaskConical size={18} />
            <h2>Проверка решения</h2>
          </div>
          <PythonOutput
            request={execution.request}
            progress={execution.progress}
            result={execution.result}
            busy={execution.busy}
            buggyLine={mission.verification.buggyLine}
            explanation={mission.verification.explanation}
            codeChanged={
              execution.request !== null &&
              (execution.request.sourceCode !== draft.code ||
                (execution.request.kind === "submit" &&
                  execution.request.selectedLine !== draft.selectedLine))
            }
          />
        </section>
        {execution.result &&
          execution.request &&
          progress.awards[execution.request.requestId] && (
            <MissionSuccess
              award={progress.awards[execution.request.requestId]}
            />
          )}
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
