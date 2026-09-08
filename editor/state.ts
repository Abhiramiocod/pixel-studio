/**
 * Editor state and reducer.
 *
 * Responsibilities are kept separate inside one store, which is the simplest
 * thing that stays clear at this size:
 *
 *   document   the design itself - the single source of truth for elements
 *   selection  ids only; never copies of elements
 *   camera     zoom and pan; view-only, never written back into the document
 *   history    batches of invertible operations
 *   tool       the active tool
 *   clipboard  detached copies for paste
 */

import {
  cloneElement,
  createDocument,
  indexOfElement,
  targetLayerIndex,
  type DesignDocument,
  type DesignElement,
  type ElementPatch,
  type LayerDirection,
} from "@/models/design";
import {
  applyOperations,
  createPatchOperation,
  createReorderOperation,
  invertOperations,
  mergePatchOperations,
  type Operation,
} from "@/models/operations";
import {
  DEFAULT_CAMERA,
  centerCamera,
  createFitCamera,
  panBy,
  stepZoom,
  zoomAt,
  zoomAtViewportCenter,
  type Camera,
  type Point,
  type Size,
} from "@/engine/coordinates";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  createHistory,
  record,
  redo as historyRedo,
  undo as historyUndo,
  type History,
} from "@/history/history";

export type Tool = "select" | "rectangle" | "text";

export type SelectionMode = "replace" | "toggle";

/** Offset applied to each successive paste/duplicate, in document units. */
export const PASTE_OFFSET = 20;

export interface ElementChange {
  id: string;
  patch: ElementPatch;
}

export interface EditorState {
  document: DesignDocument;
  selectedIds: string[];
  camera: Camera;
  viewportSize: Size;
  /** False until the viewport has been measured and the fit camera applied. */
  cameraReady: boolean;
  tool: Tool;
  history: History<Operation>;
  clipboard: DesignElement[];
  /** Number of pastes since the last copy, used to cascade offsets. */
  pasteCount: number;
}

export type EditorAction =
  | { type: "set-tool"; tool: Tool }
  | { type: "select"; ids: string[]; mode: SelectionMode }
  | { type: "add-element"; element: DesignElement }
  /**
   * Applies changes to one or more elements. A non-null `session` merges
   * consecutive dispatches into a single undo step, which is what a drag needs.
   */
  | { type: "transform"; changes: ElementChange[]; session: string | null }
  /** Applies one patch to every selected element. */
  | { type: "patch-selection"; patch: ElementPatch; session: string | null }
  /** Moves the selection by a delta, in document units. */
  | { type: "nudge"; dx: number; dy: number }
  | { type: "delete-selected" }
  | { type: "reorder"; id: string; direction: LayerDirection }
  | { type: "copy" }
  | { type: "paste" }
  | { type: "duplicate" }
  | { type: "undo" }
  | { type: "redo" }
  /** Free-form camera set, used by drag-panning which tracks its own origin. */
  | { type: "set-camera"; camera: Camera }
  | { type: "zoom-to"; zoom: number }
  | { type: "zoom-at"; zoom: number; anchor: Point }
  /** Multiplies the current zoom, used by wheel/pinch zoom. */
  | { type: "zoom-by"; factor: number; anchor: Point }
  | { type: "zoom-step"; direction: 1 | -1 }
  | { type: "zoom-fit" }
  | { type: "zoom-reset" }
  | { type: "pan-by"; dx: number; dy: number }
  | { type: "viewport-resized"; size: Size };

export function createInitialState(): EditorState {
  return {
    document: createDocument(),
    selectedIds: [],
    camera: DEFAULT_CAMERA,
    viewportSize: { width: 0, height: 0 },
    cameraReady: false,
    tool: "select",
    history: createHistory<Operation>(),
    clipboard: [],
    pasteCount: 0,
  };
}

/** Applies a batch of operations to the document and records it in history. */
function commit(
  state: EditorState,
  operations: Operation[],
  label: string,
  sessionId: string | null = null,
): EditorState {
  if (operations.length === 0) return state;
  return {
    ...state,
    document: applyOperations(state.document, operations),
    history: record(
      state.history,
      { label, ops: operations, sessionId },
      mergePatchOperations,
    ),
  };
}

/** Applies operations without touching history (used by undo/redo itself). */
function applySilently(
  state: EditorState,
  operations: readonly Operation[],
  history: History<Operation>,
): EditorState {
  const document = applyOperations(state.document, operations);
  return {
    ...state,
    document,
    history,
    selectedIds: state.selectedIds.filter((id) =>
      document.elements.some((element) => element.id === id),
    ),
  };
}

function insertElements(
  state: EditorState,
  elements: DesignElement[],
  label: string,
): EditorState {
  if (elements.length === 0) return state;
  const base = state.document.elements.length;
  const operations = elements.map<Operation>((element, offset) => ({
    kind: "insert",
    index: base + offset,
    element,
  }));
  return {
    ...commit(state, operations, label),
    selectedIds: elements.map((element) => element.id),
    tool: "select",
  };
}

/** Applies element changes and records them as one history entry. */
function transform(
  state: EditorState,
  changes: readonly ElementChange[],
  session: string | null,
): EditorState {
  const operations = changes.flatMap((change) => {
    const operation = createPatchOperation(
      state.document,
      change.id,
      change.patch,
    );
    return operation ? [operation] : [];
  });
  return commit(state, operations, "Update element", session);
}

function selectedElements(state: EditorState): DesignElement[] {
  return state.document.elements.filter((element) =>
    state.selectedIds.includes(element.id),
  );
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "set-tool":
      return { ...state, tool: action.tool };

    case "select": {
      if (action.mode === "replace") {
        return { ...state, selectedIds: action.ids };
      }
      const next = new Set(state.selectedIds);
      for (const id of action.ids) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return { ...state, selectedIds: [...next] };
    }

    case "add-element":
      return insertElements(state, [action.element], "Add element");

    case "transform":
      return transform(state, action.changes, action.session);

    case "patch-selection":
      return transform(
        state,
        state.selectedIds.map((id) => ({ id, patch: action.patch })),
        action.session,
      );

    case "nudge":
      return transform(
        state,
        selectedElements(state).map((element) => ({
          id: element.id,
          patch: { x: element.x + action.dx, y: element.y + action.dy },
        })),
        null,
      );

    case "delete-selected": {
      const operations = selectedElements(state).map<Operation>((element) => ({
        kind: "remove",
        index: indexOfElement(state.document, element.id),
        element,
      }));
      return { ...commit(state, operations, "Delete element"), selectedIds: [] };
    }

    case "reorder": {
      const from = indexOfElement(state.document, action.id);
      if (from === -1) return state;
      const to = targetLayerIndex(
        from,
        state.document.elements.length,
        action.direction,
      );
      const operation = createReorderOperation(state.document, action.id, to);
      return operation ? commit(state, [operation], "Reorder layer") : state;
    }

    case "copy": {
      const elements = selectedElements(state);
      if (elements.length === 0) return state;
      return { ...state, clipboard: elements, pasteCount: 0 };
    }

    case "paste": {
      if (state.clipboard.length === 0) return state;
      const offset = PASTE_OFFSET * (state.pasteCount + 1);
      const copies = state.clipboard.map((element) =>
        cloneElement(element, offset),
      );
      return {
        ...insertElements(state, copies, "Paste"),
        pasteCount: state.pasteCount + 1,
      };
    }

    case "duplicate": {
      const copies = selectedElements(state).map((element) =>
        cloneElement(element, PASTE_OFFSET),
      );
      return insertElements(state, copies, "Duplicate");
    }

    case "undo": {
      const step = historyUndo(state.history);
      if (!step) return state;
      return applySilently(state, invertOperations(step.entry.ops), step.history);
    }

    case "redo": {
      const step = historyRedo(state.history);
      if (!step) return state;
      return applySilently(state, step.entry.ops, step.history);
    }

    case "set-camera":
      return { ...state, camera: action.camera };

    case "zoom-to":
      return {
        ...state,
        camera: zoomAtViewportCenter(
          state.camera,
          action.zoom,
          state.viewportSize,
        ),
      };

    case "zoom-at":
      return {
        ...state,
        camera: zoomAt(state.camera, action.zoom, action.anchor),
      };

    case "zoom-by":
      return {
        ...state,
        camera: zoomAt(
          state.camera,
          state.camera.zoom * action.factor,
          action.anchor,
        ),
      };

    case "zoom-step":
      return {
        ...state,
        camera: zoomAtViewportCenter(
          state.camera,
          stepZoom(state.camera.zoom, action.direction),
          state.viewportSize,
        ),
      };

    case "zoom-fit":
      return {
        ...state,
        camera: createFitCamera(state.viewportSize, state.document),
      };

    case "zoom-reset":
      return {
        ...state,
        camera: centerCamera(1, state.viewportSize, state.document),
      };

    case "pan-by":
      return { ...state, camera: panBy(state.camera, action.dx, action.dy) };

    case "viewport-resized": {
      // The first measurement decides the initial fit; later resizes keep the
      // user's zoom and pan.
      if (state.cameraReady) return { ...state, viewportSize: action.size };
      if (action.size.width === 0 || action.size.height === 0) return state;
      return {
        ...state,
        viewportSize: action.size,
        cameraReady: true,
        camera: createFitCamera(action.size, state.document),
      };
    }
  }
}

export function canUndo(state: EditorState): boolean {
  return historyCanUndo(state.history);
}

export function canRedo(state: EditorState): boolean {
  return historyCanRedo(state.history);
}
