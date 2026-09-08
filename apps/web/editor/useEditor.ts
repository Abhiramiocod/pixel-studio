"use client";

import type {
  DesignElement,
  ShapeKind,
} from "@pixel-studio/types";
import { useMemo, useReducer } from "react";

import { createFrame, createImage, createShape, createText } from "@/models/elements";
import type { ElementPatch, LayerDirection } from "@/models/design";
import type { Camera, Point, Size } from "@/engine/coordinates";
import {
  getSelectedElements,
  getSoleSelection,
} from "@/engine/selection";
import type { ElementChange } from "@/engine/interactions";
import type { SnapGuide } from "@/engine/snapping/snapping";
import type { AlignMode, DistributeAxis } from "@/engine/alignment/align";
import {
  canGroup,
  canRedo,
  canUndo,
  canUngroup,
  createInitialState,
  editorReducer,
  type EditorState,
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
  canGroup: boolean;
  canUngroup: boolean;

  setTool: (tool: Tool) => void;
  select: (ids: string[], mode?: SelectionMode) => void;
  selectOne: (id: string, additive?: boolean) => void;
  clearSelection: () => void;

  /**
   * `at` is the centre of the new element, in document coordinates. A frame
   * under that point becomes the element's parent.
   */
  insertShape: (kind: ShapeKind, at: Point) => void;
  insertText: (at: Point) => void;
  insertFrame: (at: Point) => void;
  insertImage: (
    src: string,
    naturalWidth: number,
    naturalHeight: number,
    at: Point,
    name?: string,
  ) => void;

  /** `session` groups a continuous interaction into one undo step. */
  transform: (
    changes: ElementChange[],
    session?: string | null,
    guides?: SnapGuide[],
  ) => void;
  patchSelection: (patch: ElementPatch, session?: string | null) => void;
  patchElement: (
    id: string,
    patch: ElementPatch,
    session?: string | null,
  ) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  deleteSelection: () => void;
  reorder: (id: string, direction: LayerDirection) => void;
  group: () => void;
  ungroup: () => void;
  align: (mode: AlignMode) => void;
  distribute: (axis: DistributeAxis) => void;

  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  undo: () => void;
  redo: () => void;
  endInteraction: () => void;

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
    // The reducer positions the element and picks its parent, so a frame under
    // the insertion point receives the new element.
    const add = (element: DesignElement, at: Point) =>
      dispatch({ type: "add-element", element, at });

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

      insertShape: (kind: ShapeKind, at: Point) => add(createShape(kind), at),
      insertText: (at: Point) => add(createText(), at),
      insertFrame: (at: Point) =>
        add(createFrame({ x: 0, y: 0, width: 480, height: 320 }), at),
      insertImage: (
        src: string,
        naturalWidth: number,
        naturalHeight: number,
        at: Point,
        name?: string,
      ) => {
        const image = createImage(src, naturalWidth, naturalHeight, name);
        // Large uploads are scaled down so they land fully inside the artboard.
        const longest = Math.max(image.width, image.height);
        const scale = longest > 640 ? 640 / longest : 1;
        add(
          {
            ...image,
            width: Math.round(image.width * scale),
            height: Math.round(image.height * scale),
          },
          at,
        );
      },

      transform: (
        changes: ElementChange[],
        session: string | null = null,
        guides: SnapGuide[] = [],
      ) => dispatch({ type: "transform", changes, session, guides }),
      patchSelection: (patch: ElementPatch, session: string | null = null) =>
        dispatch({ type: "patch-selection", patch, session }),
      patchElement: (
        id: string,
        patch: ElementPatch,
        session: string | null = null,
      ) => dispatch({ type: "patch-element", id, patch, session }),
      nudgeSelection: (dx: number, dy: number) =>
        dispatch({ type: "nudge", dx, dy }),
      deleteSelection: () => dispatch({ type: "delete-selected" }),
      reorder: (id: string, direction: LayerDirection) =>
        dispatch({ type: "reorder", id, direction }),
      group: () => dispatch({ type: "group" }),
      ungroup: () => dispatch({ type: "ungroup" }),
      align: (mode: AlignMode) => dispatch({ type: "align", mode }),
      distribute: (axis: DistributeAxis) =>
        dispatch({ type: "distribute", axis }),

      copy: () => dispatch({ type: "copy" }),
      paste: () => dispatch({ type: "paste" }),
      duplicate: () => dispatch({ type: "duplicate" }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      endInteraction: () => dispatch({ type: "end-interaction" }),

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
    canGroup: canGroup(state),
    canUngroup: canUngroup(state),
  };
}
