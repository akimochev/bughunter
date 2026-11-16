"use client";

import { useEffect, useRef, useState } from "react";
import type { RunnerPhase } from "@/lib/python/types";
import { TraceRunner } from "./runner";
import type { TraceRequest, TraceResult } from "./types";

interface TraceState {
  request: TraceRequest | null;
  result: TraceResult | null;
  phase: RunnerPhase | null;
  busy: boolean;
  index: number;
}
export function usePythonTrace() {
  const [runner] = useState(() => new TraceRunner());
  const [state, setState] = useState<TraceState>({
    request: null,
    result: null,
    phase: null,
    busy: false,
    index: 0,
  });
  const mounted = useRef(false);
  const activeId = useRef<string | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeId.current = null;
      runner.dispose();
    };
  }, [runner]);
  function run(request: TraceRequest) {
    if (busy.current) return;
    busy.current = true;
    activeId.current = request.requestId;
    setState({ request, result: null, phase: "loading", busy: true, index: 0 });
    void runner
      .run(request, (phase) => {
        if (mounted.current && activeId.current === request.requestId)
          setState((previous) => ({ ...previous, phase }));
      })
      .then((result) => {
        if (!mounted.current || activeId.current !== request.requestId) return;
        busy.current = false;
        setState({
          request,
          result,
          phase: null,
          busy: false,
          index:
            result.status === "completed"
              ? 0
              : Math.max(0, result.steps.length - 1),
        });
      });
  }
  function select(index: number) {
    setState((previous) => ({
      ...previous,
      index: Math.max(
        0,
        Math.min(index, (previous.result?.steps.length ?? 1) - 1),
      ),
    }));
  }
  return { ...state, run, select, cancel: () => runner.cancel() };
}
