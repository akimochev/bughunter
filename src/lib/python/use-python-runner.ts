"use client";

import { useEffect, useRef, useState } from "react";
import { PythonRunner } from "./runner";
import type { PythonRunRequest, PythonRunResult, RunnerPhase } from "./types";

interface RunState {
  phase: "idle" | RunnerPhase | "finished";
  request: PythonRunRequest | null;
  result: PythonRunResult | null;
}

export function usePythonRunner() {
  const [runner] = useState(() => new PythonRunner());
  const [state, setState] = useState<RunState>({
    phase: "idle",
    request: null,
    result: null,
  });
  const mounted = useRef(false);
  const latestId = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      runner.dispose();
    };
  }, [runner]);

  async function run(request: PythonRunRequest) {
    latestId.current = request.requestId;
    setState({ phase: "loading", request, result: null });
    const result = await runner.run(request, (phase) => {
      if (mounted.current && latestId.current === request.requestId)
        setState({ phase, request, result: null });
    });
    if (mounted.current && latestId.current === result.requestId)
      setState({ phase: "finished", request, result });
  }

  return {
    ...state,
    busy: state.phase === "loading" || state.phase === "running",
    run,
    cancel: () => runner.cancel(),
  };
}
