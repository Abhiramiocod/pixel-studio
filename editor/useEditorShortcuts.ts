"use client";

import { useEffect, useRef } from "react";

import {
  isTextEntryTarget,
  matchesShortcut,
  type Shortcut,
} from "@/utils/keyboard";
import type { EditorApi } from "@/editor/useEditor";

const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;

export interface ShortcutBinding {
  shortcut: Shortcut;
  run: (editor: EditorApi) => void;
  /** Defaults to true; browser defaults are suppressed for editor shortcuts. */
  preventDefault?: boolean;
}

/**
 * The single source of truth for editor shortcuts. Components never attach
 * their own key listeners.
 */
export const EDITOR_SHORTCUTS: readonly ShortcutBinding[] = [
  { shortcut: { key: "Delete" }, run: (e) => e.deleteSelection() },
  { shortcut: { key: "Backspace" }, run: (e) => e.deleteSelection() },
  { shortcut: { key: "Escape" }, run: (e) => e.clearSelection() },

  { shortcut: { key: "c", mod: true }, run: (e) => e.copy() },
  { shortcut: { key: "v", mod: true }, run: (e) => e.paste() },
  { shortcut: { key: "d", mod: true }, run: (e) => e.duplicate() },

  { shortcut: { key: "z", mod: true }, run: (e) => e.undo() },
  { shortcut: { key: "z", mod: true, shift: true }, run: (e) => e.redo() },
  { shortcut: { key: "y", mod: true }, run: (e) => e.redo() },

  {
    shortcut: { key: "ArrowUp" },
    run: (e) => e.nudgeSelection(0, -NUDGE_STEP),
  },
  {
    shortcut: { key: "ArrowDown" },
    run: (e) => e.nudgeSelection(0, NUDGE_STEP),
  },
  {
    shortcut: { key: "ArrowLeft" },
    run: (e) => e.nudgeSelection(-NUDGE_STEP, 0),
  },
  {
    shortcut: { key: "ArrowRight" },
    run: (e) => e.nudgeSelection(NUDGE_STEP, 0),
  },
  {
    shortcut: { key: "ArrowUp", shift: true },
    run: (e) => e.nudgeSelection(0, -NUDGE_STEP_LARGE),
  },
  {
    shortcut: { key: "ArrowDown", shift: true },
    run: (e) => e.nudgeSelection(0, NUDGE_STEP_LARGE),
  },
  {
    shortcut: { key: "ArrowLeft", shift: true },
    run: (e) => e.nudgeSelection(-NUDGE_STEP_LARGE, 0),
  },
  {
    shortcut: { key: "ArrowRight", shift: true },
    run: (e) => e.nudgeSelection(NUDGE_STEP_LARGE, 0),
  },

  { shortcut: { key: "=", mod: true }, run: (e) => e.zoomIn() },
  { shortcut: { key: "-", mod: true }, run: (e) => e.zoomOut() },
  { shortcut: { key: "0", mod: true }, run: (e) => e.resetZoom() },
  { shortcut: { key: "1", mod: true }, run: (e) => e.zoomToFit() },
];

/** Attaches the shortcut table to the window for the lifetime of the editor. */
export function useEditorShortcuts(editor: EditorApi): void {
  // The API object is recreated on every render, so the listener reads it
  // through a ref and is registered only once.
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;

      for (const binding of EDITOR_SHORTCUTS) {
        if (!matchesShortcut(event, binding.shortcut)) continue;
        if (binding.preventDefault !== false) event.preventDefault();
        binding.run(editorRef.current);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
