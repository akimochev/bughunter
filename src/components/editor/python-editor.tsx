"use client";

import { useEffect, useRef } from "react";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags } from "@lezer/highlight";
import { MAX_CODE_LENGTH } from "@/lib/mission-draft";

const selectLine = StateEffect.define<number | null>();
const setTraceLine = StateEffect.define<number | null>();
const tracedLine = StateField.define<number | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects)
      if (effect.is(setTraceLine)) value = effect.value;
    return value;
  },
});
const traceHighlight = EditorView.decorations.compute(
  ["doc", tracedLine],
  (state) => {
    const line = state.field(tracedLine);
    if (line === null || line < 1 || line > state.doc.lines)
      return Decoration.none;
    return Decoration.set([
      Decoration.line({ class: "cm-trace-line" }).range(
        state.doc.line(line).from,
      ),
    ]);
  },
);
const selectedLine = StateField.define<number | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects)
      if (effect.is(selectLine)) value = effect.value;
    return value;
  },
});

// The decoration uses a document position derived from the original line number.
const lineHighlight = EditorView.decorations.compute(
  ["doc", selectedLine],
  (state) => {
    const line = state.field(selectedLine);
    if (line === null || line > state.doc.lines) return Decoration.none;
    return Decoration.set([
      Decoration.line({ class: "cm-suspect-line" }).range(
        state.doc.line(line).from,
      ),
    ]);
  },
);

const theme = EditorView.theme(
  {
    "&": { color: "#d3d9ee", backgroundColor: "#0e1626", fontSize: "13px" },
    ".cm-scroller": {
      fontFamily: "var(--font-code)",
      overflow: "auto",
      minHeight: "290px",
      maxHeight: "480px",
    },
    ".cm-content": {
      padding: "18px 0",
      minHeight: "290px",
      caretColor: "#c4a7ff",
    },
    ".cm-line": { padding: "0 16px", lineHeight: "1.9" },
    ".cm-gutters": {
      backgroundColor: "#111a2b",
      borderRight: "1px solid #263047",
      color: "#8e9ab6",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 10px",
      minWidth: "40px",
      lineHeight: "1.9",
    },
    "&.cm-focused": { outline: "2px solid #8b5cf6", outlineOffset: "-2px" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "#8b5cf640",
    },
    ".cm-suspect-line": {
      backgroundColor: "#8b5cf624",
      boxShadow: "inset 3px 0 #b89af6",
    },
    ".cm-trace-line": {
      backgroundColor: "#22d3ee24",
      boxShadow: "inset 3px 0 #67e8f9",
    },
  },
  { dark: true },
);

const highlighting = HighlightStyle.define([
  { tag: tags.keyword, color: "#c4a4ed" },
  { tag: tags.function(tags.variableName), color: "#8fc9e5" },
  { tag: [tags.number, tags.bool], color: "#edba83" },
  { tag: tags.string, color: "#9ed9b3" },
  { tag: tags.comment, color: "#8896b1" },
]);

interface PythonEditorProps {
  code: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
  selectedOriginalLine?: number | null;
  onSelectLine?: (line: number) => void;
  traceLine?: number | null;
  label?: string;
}

export default function PythonEditor({
  code,
  onChange,
  readOnly = false,
  selectedOriginalLine = null,
  onSelectLine,
  traceLine = null,
  label,
}: PythonEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onSelectLine });

  useEffect(() => {
    callbacks.current = { onChange, onSelectLine };
  }, [onChange, onSelectLine]);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        extensions: [
          python(),
          theme,
          syntaxHighlighting(highlighting),
          indentUnit.of("    "),
          history(),
          drawSelection(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({
            "aria-label":
              label ??
              (readOnly
                ? "Исходный Python-код. Выбери подозрительную строку."
                : "Редактор исправления Python"),
            spellcheck: "false",
            autocapitalize: "off",
            autocorrect: "off",
          }),
          EditorState.transactionFilter.of((transaction) =>
            transaction.newDoc.length > MAX_CODE_LENGTH ? [] : transaction,
          ),
          lineNumbers({
            domEventHandlers: {
              click(view, line) {
                if (!readOnly) return false;
                callbacks.current.onSelectLine?.(
                  view.state.doc.lineAt(line.from).number,
                );
                return true;
              },
            },
          }),
          selectedLine,
          lineHighlight,
          tracedLine,
          traceHighlight,
          EditorView.domEventHandlers({
            click(event, view) {
              if (!readOnly) return false;
              const position = view.posAtCoords({
                x: event.clientX,
                y: event.clientY,
              });
              if (position !== null)
                callbacks.current.onSelectLine?.(
                  view.state.doc.lineAt(position).number,
                );
              return false;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              callbacks.current.onChange?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    editor.current = view;
    return () => {
      editor.current = null;
      view.destroy();
    };
  }, [readOnly, label]);

  useEffect(() => {
    const view = editor.current;
    if (!view || view.state.doc.toString() === code) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: code },
    });
  }, [code, readOnly]);

  useEffect(() => {
    editor.current?.dispatch({
      effects: selectLine.of(readOnly ? selectedOriginalLine : null),
    });
  }, [selectedOriginalLine, readOnly]);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    const line =
      traceLine !== null && traceLine >= 1 && traceLine <= view.state.doc.lines
        ? traceLine
        : null;
    view.dispatch({
      effects: [
        setTraceLine.of(line),
        ...(line === null
          ? []
          : [
              EditorView.scrollIntoView(view.state.doc.line(line).from, {
                y: "nearest",
              }),
            ]),
      ],
    });
  }, [traceLine, code, readOnly, label]);

  return (
    <div
      ref={host}
      className={`python-editor${readOnly ? " source-editor" : ""}`}
    />
  );
}
