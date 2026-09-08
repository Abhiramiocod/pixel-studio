"use client";

import { useMemo, useReducer } from "react";

import {
  createRectangle,
  createText,
  type DesignElement,
  type ElementPatch,
  type LayerDirection,
} from "@/models/design";
import type { Camera, Point, Size } from "@/engine/coordinates";
import { getSelectedElements, getSoleSelection } from "@/engine/selection";
import {
  canRedo,
  canUndo,
  createInitialState,
  editorReducer,
  type EditorState,
  type ElementChange,
  type SelectionMode,
  type Tool,
} from "@/editor/state";

export interface EditorApi {
  state: EditorState;
  selectedElements: DesignElement[];
  /** The element shown in the properties panel; null unless exactly one. */
  soleSelection: DesignElement | null;
  canUndo: boolean;
  canRedo: boolean;

  setTool: (tool: Tool) => void;
  select: (ids: string[], mode?: SelectionMode) => void;
  selectOne: (id: string, additive?: boolean) => void;
  clearSelection: () => void;

  /** `at` is the centre of the new element, in document coordinates. */
  insertRectangle: (at: Point) => void;
  insertText: (at: Point) => void;

  /** `session` groups a continuous interaction into one undo step. */
  transform: (changes: ElementChange[], session?: string | null) => void;
  patchSelection: (patch: ElementPatch, session?: string | null) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  deleteSelection: () => void;
  reorder: (id: string, direction: LayerDirection) => void;

  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  undo: () => void;
  redo: () => void;

  setCamera: (camera: Camera) => void;
  zoomTo: (zoom: number) => void;
  zoomAtPoint: (zoom: number, anchor: Point) => void;
  zoomByFactor: (factor: number, anchor: Point) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  resetZoom: () => void;
  panViewport: (dx: number, dy: number) => void;
  viewportResized: (size: Size) => void;
}

/**
 * Binds the editor reducer to React. Components talk to this API only and never
 * build actions themselves.
 *
 * Every action carries just its inputs; the reducer derives the rest from the
 * current state. That keeps these callbacks stable for the life of the editor
 * and free of stale-state hazards during rapid input (drag, wheel, key repeat).
 */
export function useEditor(): EditorApi {
  const [state, dispatch] = useReducer(
    editorReducer,
    undefined,
    createInitialState,
  );

  const actions = useMemo(() => {
    const insertAt = (element: DesignElement, at: Point) =>
      dispatch({
        type: "add-element",
        element: {
          ...element,
          x: Math.round(at.x - element.width / 2),
          y: Math.round(at.y - element.height / 2),
        },
      });

    return {
      setTool: (tool: Tool) => dispatch({ type: "set-tool", tool }),
      select: (ids: string[], mode: SelectionMode = "replace") =>
        dispatch({ type: "select", ids, mode }),
      selectOne: (id: string, additive = false) =>
        dispatch({
          type: "select",
          ids: [id],
          mode: additive ? "toggle" : "replace",
        }),
      clearSelection: () =>
        dispatch({ type: "select", ids: [], mode: "replace" }),

      insertRectangle: (at: Point) => insertAt(createRectangle(0, 0), at),
      insertText: (at: Point) => insertAt(createText(0, 0), at),

      transform: (changes: ElementChange[], session: string | null = null) =>
        dispatch({ type: "transform", changes, session }),
      patchSelection: (patch: ElementPatch, session: string | null = null) =>
        dispatch({ type: "patch-selection", patch, session }),
      nudgeSelection: (dx: number, dy: number) =>
        dispatch({ type: "nudge", dx, dy }),
      deleteSelection: () => dispatch({ type: "delete-selected" }),
      reorder: (id: string, direction: LayerDirection) =>
        dispatch({ type: "reorder", id, direction }),

      copy: () => dispatch({ type: "copy" }),
      paste: () => dispatch({ type: "paste" }),
      duplicate: () => dispatch({ type: "duplicate" }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),

      setCamera: (camera: Camera) => dispatch({ type: "set-camera", camera }),
      zoomTo: (zoom: number) => dispatch({ type: "zoom-to", zoom }),
      zoomAtPoint: (zoom: number, anchor: Point) =>
        dispatch({ type: "zoom-at", zoom, anchor }),
      zoomByFactor: (factor: number, anchor: Point) =>
        dispatch({ type: "zoom-by", factor, anchor }),
      zoomIn: () => dispatch({ type: "zoom-step", direction: 1 }),
      zoomOut: () => dispatch({ type: "zoom-step", direction: -1 }),
      zoomToFit: () => dispatch({ type: "zoom-fit" }),
      resetZoom: () => dispatch({ type: "zoom-reset" }),
      panViewport: (dx: number, dy: number) =>
        dispatch({ type: "pan-by", dx, dy }),
      viewportResized: (size: Size) =>
        dispatch({ type: "viewport-resized", size }),
    };
  }, []);

  return {
    ...actions,
    state,
    selectedElements: getSelectedElements(state.document, state.selectedIds),
    soleSelection: getSoleSelection(state.document, state.selectedIds),
    canUndo: canUndo(state),
    canRedo: canRedo(state),
  };
}
