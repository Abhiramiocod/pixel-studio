"use client";

import { useCallback, useMemo, useReducer } from "react";

import {
  createRectangle,
  createText,
  findElement,
  type DesignElement,
  type ElementPatch,
} from "@/models/design";
import type { Point } from "@/engine/coordinates";
import {
  canRedo,
  canUndo,
  createInitialState,
  editorReducer,
  type EditorState,
  type Tool,
} from "@/editor/state";

export interface EditorApi {
  state: EditorState;
  selectedElement: DesignElement | null;
  canUndo: boolean;
  canRedo: boolean;
  setTool: (tool: Tool) => void;
  select: (id: string | null) => void;
  insertRectangle: (center: Point) => void;
  insertText: (center: Point) => void;
  updateElement: (id: string, patch: ElementPatch, commit?: boolean) => void;
  beginTransaction: () => void;
  deleteElement: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

/** Binds the editor reducer to React; components never reach into state directly. */
export function useEditor(): EditorApi {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialState);

  const insertAtCenter = useCallback(
    (element: DesignElement, center: Point) => {
      dispatch({
        type: "add-element",
        element: {
          ...element,
          x: Math.round(center.x - element.width / 2),
          y: Math.round(center.y - element.height / 2),
        },
      });
    },
    [],
  );

  const api = useMemo<Omit<EditorApi, "state" | "selectedElement" | "canUndo" | "canRedo">>(
    () => ({
      setTool: (tool) => dispatch({ type: "set-tool", tool }),
      select: (id) => dispatch({ type: "select", id }),
      insertRectangle: (center) => insertAtCenter(createRectangle(0, 0), center),
      insertText: (center) => insertAtCenter(createText(0, 0), center),
      updateElement: (id, patch, commit = true) =>
        dispatch({ type: "update-element", id, patch, commit }),
      beginTransaction: () => dispatch({ type: "begin-transaction" }),
      deleteElement: (id) => dispatch({ type: "delete-element", id }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
    }),
    [insertAtCenter],
  );

  return {
    ...api,
    state,
    selectedElement: findElement(state.document, state.selectedId),
    canUndo: canUndo(state),
    canRedo: canRedo(state),
  };
}
