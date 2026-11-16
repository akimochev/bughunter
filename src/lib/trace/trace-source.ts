import { EXECUTION_TIMEOUT_MS } from "@/lib/python/constants";
import {
  MAX_TRACE_BYTES,
  MAX_TRACE_DEPTH,
  MAX_TRACE_ITEMS,
  MAX_TRACE_LOCALS,
  MAX_TRACE_STEPS,
  MAX_TRACE_VALUE_LENGTH,
} from "./constants";

// Constant driver, with source/arguments supplied separately as JSON. The callback
// receives JSON strings, never Python objects. Only <bughunter-user> is traced.
export const TRACE_SOURCE = `
import json as _trace_json
import sys as _trace_sys
import time as _trace_time
import itertools as _trace_iter
import dis as _trace_dis

def _bughunter_trace_execute(payload_json, emit):
    payload = _trace_json.loads(payload_json)
    filename = "<bughunter-user>"
    count, size = 0, 2
    limit_message = None
    frames, pending_errors = {}, {}
    next_frame = 0
    started = _trace_time.monotonic()

    class TraceLimitError(BaseException):
        pass
    class TraceTimeoutError(BaseException):
        pass

    def type_name(value):
        name = type.__dict__["__name__"].__get__(type(value))
        return name[:80] if type(name) is str else "object"

    def snapshot(value):
        clipped, budget = [False], [80]
        def render(item, depth, ancestors):
            budget[0] -= 1
            kind = type(item)
            if budget[0] < 0:
                clipped[0] = True
                return "…"
            if item is None:
                return "None"
            if kind is bool:
                return "True" if item else "False"
            if kind is int:
                if int.bit_length(item) > 2048:
                    clipped[0] = True
                    return "<большое целое число>"
                return int.__repr__(item)
            if kind is float:
                return float.__repr__(item)
            if kind is str:
                if len(item) > ${MAX_TRACE_VALUE_LENGTH}:
                    clipped[0] = True
                return str.__repr__(item[:${MAX_TRACE_VALUE_LENGTH}])
            if kind not in (list, tuple, dict):
                clipped[0] = True
                return "<" + type_name(item) + ">"
            if id(item) in ancestors:
                clipped[0] = True
                return "<циклическая ссылка>"
            if depth >= ${MAX_TRACE_DEPTH}:
                clipped[0] = True
                return "<" + type_name(item) + ": ограничение глубины>"
            path = ancestors | {id(item)}
            if kind is dict:
                parts = [render(key, depth + 1, path) + ": " + render(val, depth + 1, path)
                         for key, val in _trace_iter.islice(dict.items(item), ${MAX_TRACE_ITEMS})]
                left, right = "{", "}"
            else:
                parts = [render(val, depth + 1, path) for val in _trace_iter.islice(item, ${MAX_TRACE_ITEMS})]
                left, right = ("[", "]") if kind is list else ("(", ")")
                if kind is tuple and len(item) == 1:
                    parts[0] += ","
            if len(item) > ${MAX_TRACE_ITEMS}:
                clipped[0] = True
                parts.append("…")
            text = left + ", ".join(parts) + right
            if len(text) > ${MAX_TRACE_VALUE_LENGTH}:
                clipped[0] = True
                text = text[:${MAX_TRACE_VALUE_LENGTH} - 1] + "…"
            return text
        text = render(value, 0, set())
        if len(text) > ${MAX_TRACE_VALUE_LENGTH}:
            text = text[:${MAX_TRACE_VALUE_LENGTH} - 1] + "…"
            clipped[0] = True
        return {"type": type_name(value), "display": text, "truncated": clipped[0]}

    def error_info(error, line=None):
        # BaseException's descriptor bypasses arbitrary user __str__/__repr__.
        args = BaseException.args.__get__(error)
        message = args[0][:240] if args and type(args[0]) is str else snapshot(args)["display"][:240]
        result = {"type": type_name(error), "message": message}
        if line is not None:
            result["lineNumber"] = line
        return result

    def trace(frame, event, arg):
        nonlocal count, size, next_frame, limit_message
        if frame.f_code.co_filename != filename:
            return None
        if event not in ("call", "line", "return", "exception"):
            return trace
        if _trace_time.monotonic() - started >= ${EXECUTION_TIMEOUT_MS / 1000}:
            raise TraceTimeoutError("Превышен лимит исполнения отладки 5 секунд.")
        key = id(frame)
        if key not in frames:
            next_frame += 1
            frames[key] = next_frame
        depth, parent = 0, frame.f_back
        while parent is not None:
            if parent.f_code.co_filename == filename:
                depth += 1
            parent = parent.f_back
        variables, truncated = {}, False
        for name, value in frame.f_locals.items():
            if name in ("__builtins__", "__name__"):
                continue
            if len(variables) >= ${MAX_TRACE_LOCALS}:
                truncated = True
                break
            variables[name] = snapshot(value)
        step = {"lineNumber": max(0, frame.f_lineno), "eventType": event,
                "functionName": frame.f_code.co_name[:80], "variables": variables,
                "variablesTruncated": truncated, "stackDepth": depth, "frameId": frames[key]}
        if event == "exception":
            pending_errors[key] = error_info(arg[1], frame.f_lineno)
            step["error"] = pending_errors[key]
        elif event == "return":
            opcode = _trace_dis.opname[frame.f_code.co_code[frame.f_lasti]]
            if opcode in ("RETURN_VALUE", "RETURN_CONST"):
                step["returnValue"] = snapshot(arg)
            elif key in pending_errors:
                step["error"] = pending_errors[key]
            frames.pop(key, None)
            pending_errors.pop(key, None)
        encoded = _trace_json.dumps(step, ensure_ascii=True, separators=(",", ":"))
        next_size = size + len(encoded) + (1 if count else 0)
        if next_size > ${MAX_TRACE_BYTES}:
            limit_message = "Достигнут лимит объёма трассы 512 КиБ. Сохранены доступные шаги."
            raise TraceLimitError(limit_message)
        size = next_size
        emit(encoded)
        count += 1
        if count >= ${MAX_TRACE_STEPS}:
            limit_message = "Достигнут лимит 300 шагов. Сохранены доступные шаги."
            raise TraceLimitError(limit_message)
        return trace

    try:
        code = compile(payload["sourceCode"], filename, "exec")
        namespace = {"__name__": "__main__"}
        _trace_sys.settrace(trace)
        exec(code, namespace)
        function = namespace.get(payload["functionName"])
        if not callable(function):
            raise NameError("Не найдена функция " + payload["functionName"])
        result = function(*payload["args"])
        _trace_sys.settrace(None)
        if limit_message is not None:
            raise TraceLimitError(limit_message)
        return _trace_json.dumps({"status": "success", "hasReturnValue": True,
            "returnValue": snapshot(result), "errorType": None, "errorMessage": None}, ensure_ascii=True)
    except BaseException as error:
        _trace_sys.settrace(None)
        line = None
        tb = BaseException.__traceback__.__get__(error)
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == filename:
                line = tb.tb_lineno
            tb = tb.tb_next
        if isinstance(error, SyntaxError):
            line = SyntaxError.lineno.__get__(error)
        info = error_info(error, line)
        return _trace_json.dumps({"status": "error", "hasReturnValue": False,
            "errorType": info["type"], "errorMessage": info["message"], "errorLine": line}, ensure_ascii=True)
    finally:
        _trace_sys.settrace(None)

_bughunter_trace_result_json = _bughunter_trace_execute(_bughunter_payload_json, _bughunter_trace_emit)
_bughunter_trace_result_json
`;
