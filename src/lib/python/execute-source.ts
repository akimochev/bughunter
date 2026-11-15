// The program is constant. User source and arguments arrive as JSON data in a separate global.
export const EXECUTE_SOURCE = `
import json as _json
import math as _math

def _bughunter_execute(payload_json):
    payload = _json.loads(payload_json)
    class UnsupportedReturnType(TypeError):
        pass
    def validate(value, depth=0, budget=None):
        if budget is None:
            budget = [10000]
        budget[0] -= 1
        if depth > 30 or budget[0] < 0:
            raise UnsupportedReturnType("Результат слишком большой или глубоко вложенный")
        if value is None or type(value) in (str, bool):
            return
        if type(value) is int:
            if abs(value) > 9007199254740991:
                raise UnsupportedReturnType("Целое число выходит за точный диапазон JavaScript")
            return
        if type(value) is float and _math.isfinite(value):
            return
        if type(value) is list:
            for item in value:
                validate(item, depth + 1, budget)
            return
        if type(value) is dict and all(type(key) is str for key in value):
            for item in value.values():
                validate(item, depth + 1, budget)
            return
        raise UnsupportedReturnType("Верни число, строку, bool, None, список или словарь со строковыми ключами")
    try:
        namespace = {"__name__": "__main__"}
        exec(compile(payload["sourceCode"], "<mission>", "exec"), namespace)
        function = namespace.get(payload["functionName"])
        if not callable(function):
            raise NameError("Не найдена функция " + payload["functionName"])
        result = function(*payload["args"])
        validate(result)
        serialized = _json.dumps(result, ensure_ascii=True, allow_nan=False)
        if len(serialized) > 30000:
            raise UnsupportedReturnType("Результат превышает лимит 30 000 символов")
        return '{"status":"success","hasReturnValue":true,"returnValue":' + serialized + ',"errorType":null,"errorMessage":null}'
    except BaseException as error:
        return _json.dumps({"status": "error", "hasReturnValue": False, "errorType": type(error).__name__, "errorMessage": str(error)[:3000]}, ensure_ascii=True)

_bughunter_execute(_bughunter_payload_json)
`;
