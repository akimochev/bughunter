import type { PyodideInterface } from "pyodide";
import { MAX_OUTPUT_BYTES, PYODIDE_INDEX_URL } from "@/lib/python/constants";
import { EXECUTE_SOURCE } from "@/lib/python/execute-source";
import { TRACE_SOURCE } from "@/lib/trace/trace-source";
import type {
  PythonOutcome,
  WorkerCommand,
  WorkerResponse,
} from "@/lib/python/types";

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<WorkerCommand>) => void;
  postMessage: (message: WorkerResponse) => void;
};

let runtime: PyodideInterface | null = null;
let currentId = "";

scope.onmessage = async ({ data }) => {
  if (data.type === "load") {
    currentId = data.requestId;
    try {
      const { loadPyodide } = (await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ `${PYODIDE_INDEX_URL}pyodide.mjs`
      )) as typeof import("pyodide");
      runtime = await loadPyodide({
        indexURL: PYODIDE_INDEX_URL,
        stdout: () => {},
        stderr: () => {},
      });
      runtime.setStdin({ error: true });
      scope.postMessage({ type: "ready", requestId: currentId });
    } catch {
      scope.postMessage({
        type: "result",
        requestId: currentId,
        outcome: {
          status: "error",
          hasReturnValue: false,
          errorType: "LoadError",
          errorMessage:
            "Не удалось загрузить Python. Проверь соединение с сайтом, затем повтори запуск.",
        },
      });
    }
    return;
  }

  const { request } = data;
  if (!runtime || request.requestId !== currentId) return;
  let written = 0;
  const capture = (stream: "stdout" | "stderr") => {
    const decoder = new TextDecoder();
    return (buffer: Uint8Array) => {
      const remaining = MAX_OUTPUT_BYTES - written;
      const chunk = buffer.subarray(0, Math.max(0, remaining));
      written += chunk.length;
      const text = decoder.decode(chunk, { stream: true });
      if (text)
        scope.postMessage({
          type: "output",
          requestId: currentId,
          stream,
          text,
        });
      if (buffer.length > remaining) {
        scope.postMessage({
          type: "result",
          requestId: currentId,
          outcome: {
            status: "error",
            hasReturnValue: false,
            errorType: "OutputLimitError",
            errorMessage:
              "Превышен лимит вывода 16 КБ. Сократи print() и повтори запуск.",
          },
        });
        throw new Error("OutputLimitError");
      }
      return buffer.length;
    };
  };
  runtime.setStdout({ write: capture("stdout") });
  runtime.setStderr({ write: capture("stderr") });
  runtime.globals.set("_bughunter_payload_json", JSON.stringify(request));
  try {
    if (request.mode === "trace")
      runtime.globals.set("_bughunter_trace_emit", (encoded: string) => {
        scope.postMessage({
          type: "trace-step",
          requestId: currentId,
          step: JSON.parse(encoded),
        });
      });
    const outcome: PythonOutcome = JSON.parse(
      runtime.runPython(
        request.mode === "trace" ? TRACE_SOURCE : EXECUTE_SOURCE,
      ),
    );
    runtime.runPython(
      "import sys as _sys; _sys.stdout.flush(); _sys.stderr.flush()",
    );
    scope.postMessage({ type: "result", requestId: currentId, outcome });
  } catch {
    scope.postMessage({
      type: "result",
      requestId: currentId,
      outcome: {
        status: "error",
        hasReturnValue: false,
        errorType: "ExecutionError",
        errorMessage:
          "Не удалось обработать результат Python. Используй простую функцию с JSON-совместимым результатом.",
      },
    });
  }
};
