"use client";

import { useEffect, useRef, useState } from "react";
import { SolutionVerifier } from "./verifier";
import type {
  CheckKind,
  VerificationProgress,
  VerificationRequest,
  VerificationResult,
} from "./types";

export interface SolutionCheck extends VerificationRequest {
  kind: CheckKind;
  selectedLine: number | null;
}

interface CheckState {
  request: SolutionCheck | null;
  progress: VerificationProgress | null;
  result: VerificationResult | null;
  busy: boolean;
}

export function useSolutionVerifier() {
  const [verifier] = useState(() => new SolutionVerifier());
  const [state, setState] = useState<CheckState>({
    request: null,
    progress: null,
    result: null,
    busy: false,
  });
  const mounted = useRef(false);
  const busy = useRef(false);
  const latestId = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      verifier.dispose();
    };
  }, [verifier]);

  function check(
    request: SolutionCheck,
    onComplete?: (result: VerificationResult) => void,
  ): boolean {
    if (busy.current) return false;
    busy.current = true;
    latestId.current = request.requestId;
    setState({ request, progress: null, result: null, busy: true });
    async function execute() {
      let result: VerificationResult;
      try {
        result = await verifier.verify(request, (progress) => {
          if (mounted.current && latestId.current === request.requestId)
            setState({ request, progress, result: null, busy: true });
        });
      } catch {
        result = {
          requestId: request.requestId,
          status: "error",
          results: [],
          passed: 0,
          total: request.testCases.length,
          durationMs: 0,
          errorMessage: "Не удалось завершить проверку. Попробуй ещё раз.",
        };
      }
      if (latestId.current !== request.requestId) return;
      busy.current = false;
      onComplete?.(result);
      if (mounted.current)
        setState({ request, result, progress: null, busy: false });
    }
    void execute();
    return true;
  }

  function reset() {
    if (busy.current) return;
    latestId.current = null;
    setState({ request: null, progress: null, result: null, busy: false });
  }
  return { ...state, check, cancel: () => verifier.cancel(), reset };
}
