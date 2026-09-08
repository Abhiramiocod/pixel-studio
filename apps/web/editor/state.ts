/**
 * Editor state and reducer.
 *
 * Responsibilities stay separate inside one store, which is the simplest thing
 * that remains clear at this size:
 *
 *   document     the design tree - the single source of truth
 *   selection    ids only, never copies of elements
 *   camera       zoom and pan; view-only, never written into the document
 *   history      batches of invertible operations
 *   interaction  transient drag feedback (snap guides); never in history
 *   tool         the active tool
 *   clipboard    detached copies for paste
 */

import type {
  DesignDocument,
  DesignElement,
  FrameElement,
} from "@pixel-studio/types";
import { applyPatch, locateElement, siblingsOf, targetLayerIndex, type ElementPatch, type LayerDirection } from "@/models/design";
import { createDocument } from "@/models/design";
import { childrenOf, cloneElementTree, createGroup, isContainer } from "@/models/elements";
import {
  applyOperations,
  createPatchOperation,
  createReorderOperation,
  createRemoveOperation,
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
import { applyToPoint, type Matrix } from "@/engine/geometry/matrix";
import { boundsOfPoints, transformedCorners } from "@/engine/geometry/bounds";
import {
  elementCenter,
  localMatrix,
  subtreeBounds,
  toElementSpace,
  toParentDelta,
} from "@/engine/transformations";
import {
  getSelectedElements,
  normalizeSelection,
  selectionBounds,
} from "@/engine/selection";
import {
  alignElements,
  distributeElements,
  type AlignMode,
  type AlignTarget,
  type DistributeAxis,
} from "@/engine/alignment/align";
import type { SnapGuide } from "@/engine/snapping/snapping";
import type { ElementChange } from "@/engine/interactions";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  createHistory,
  record,
  redo as historyRedo,
  undo as historyUndo,
  type History,
} from "@/history/history";

export type Tool = "select" | "shape" | "text" | "frame";

export type SelectionMode = "replace" | "toggle" | "add";

/** Offset applied to each successive paste/duplicate, in document units. */
export const PASTE_OFFSET = 20;

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
  /** Pastes since the last copy, used to cascade offsets. */
  pasteCount: number;
  /** Transient interaction feedback; deliberately outside history. */
  guides: SnapGuide[];
}

export type EditorAction =
  | { type: "set-tool"; tool: Tool }
  | { type: "select"; ids: string[]; mode: SelectionMode }
  /**
   * Inserts `element` centred on the document point `at`. A frame under that
   * point becomes the parent, so frames actually contain what is drawn in them.
   */
  | { type: "add-element"; element: DesignElement; at?: Point }
  /**
   * Applies changes to one or more elements. A non-null `session` merges
   * consecutive dispatches into a single undo step, which is what a drag needs.
   */
  | {
      type: "transform";
      changes: ElementChange[];
      session: string | null;
      guides?: SnapGuide[];
    }
  | { type: "patch-selection"; patch: ElementPatch; session: string | null }
  | { type: "patch-element"; id: string; patch: ElementPatch; session: string | null }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "delete-selected" }
  | { type: "reorder"; id: string; direction: LayerDirection }
  | { type: "group" }
  | { type: "ungroup" }
  | { type: "align"; mode: AlignMode }
  | { type: "distribute"; axis: DistributeAxis }
  | { type: "copy" }
  | { type: "paste" }
  | { type: "duplicate" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "end-interaction" }
  | { type: "set-camera"; camera: Camera }
  | { type: "zoom-to"; zoom: number }
  | { type: "zoom-at"; zoom: number; anchor: Point }
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
    guides: [],
  };
}

/* ------------------------------------------------------------------ *
 * Committing operations
 * ------------------------------------------------------------------ */

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
    guides: [],
    selectedIds: normalizeSelection(document, state.selectedIds),
  };
}

function transform(
  state: EditorState,
  changes: readonly ElementChange[],
  session: string | null,
  guides: SnapGuide[] = [],
): EditorState {
  const operations = changes.flatMap((change) => {
    const operation = createPatchOperation(
      state.document,
      change.id,
      change.patch,
    );
    return operation ? [operation] : [];
  });
  const next = commit(state, operations, "Update element", session);
  return next.guides === guides ? next : { ...next, guides };
}

function selected(state: EditorState): DesignElement[] {
  return getSelectedElements(state.document, state.selectedIds);
}

/**
 * Removal operations for a set of elements, ordered so that undoing them
 * re-inserts in ascending index order and the original stacking is restored.
 */
function removeOperations(
  state: EditorState,
  ids: readonly string[],
): Operation[] {
  const operations = ids.flatMap((id) => {
    const operation = createRemoveOperation(state.document, id);
    return operation ? [operation] : [];
  });
  return operations.sort((a, b) => {
    const indexA = a.kind === "remove" ? a.index : 0;
    const indexB = b.kind === "remove" ? b.index : 0;
    return indexB - indexA;
  });
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
    parentId: null,
    index: base + offset,
    element,
  }));
  return {
    ...commit(state, operations, label),
    selectedIds: elements.map((element) => element.id),
    tool: "select",
  };
}

/* ------------------------------------------------------------------ *
 * Insertion
 * ------------------------------------------------------------------ */

/** The innermost visible frame containing a document point, if any. */
function frameAtPoint(
  doc: DesignDocument,
  point: Point,
  elements: readonly DesignElement[] = doc.elements,
): FrameElement | null {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const element = elements[i];
    if (!element.visible || element.locked) continue;
    if (!isContainer(element)) continue;

    const nested = frameAtPoint(doc, point, element.children);
    if (nested) return nested;

    if (element.type === "frame") {
      const local = toElementSpace(doc, element.id, point);
      if (
        local.x >= 0 &&
        local.x <= element.width &&
        local.y >= 0 &&
        local.y <= element.height
      ) {
        return element;
      }
    }
  }
  return null;
}

/**
 * Chooses the parent for a new element and positions it there. `at` is a
 * document-space point that becomes the element's centre; without it the
 * element keeps the coordinates it was created with and lands at the top level.
 */
function placeElement(
  state: EditorState,
  element: DesignElement,
  at: Point | undefined,
): { element: DesignElement; parentId: string | null } {
  if (!at) return { element, parentId: null };

  const center = at;
  // A frame is never nested into another frame by this path.
  const frame =
    element.type === "frame" ? null : frameAtPoint(state.document, center);
  const local = frame
    ? toElementSpace(state.document, frame.id, center)
    : center;

  return {
    parentId: frame?.id ?? null,
    element: {
      ...element,
      x: Math.round(local.x - element.width / 2),
      y: Math.round(local.y - element.height / 2),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Grouping
 * ------------------------------------------------------------------ */

/** Box of an element in its own parent's coordinate space. */
function parentSpaceBounds(element: DesignElement) {
  return boundsOfPoints(
    transformedCorners(element.width, element.height, localMatrix(element)),
  );
}

/**
 * Wraps the selection in a group. Only siblings can be grouped, so elements
 * from other branches are ignored rather than silently reparented.
 */
function groupSelection(state: EditorState): EditorState {
  const ids = normalizeSelection(state.document, state.selectedIds);
  const locations = ids.flatMap((id) => {
    const location = locateElement(state.document, id);
    return location ? [location] : [];
  });
  if (locations.length < 2) return state;

  const parentId = locations[0].parentId;
  const siblings = locations
    .filter((location) => location.parentId === parentId)
    .sort((a, b) => a.index - b.index);
  if (siblings.length < 2) return state;

  const boxes = siblings.flatMap((location) => {
    const bounds = parentSpaceBounds(location.element);
    return bounds ? [bounds] : [];
  });
  const corners = boxes.flatMap((box) => [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
  ]);
  const bounds = boundsOfPoints(corners);
  if (!bounds) return state;

  // Children keep their geometry, re-expressed relative to the group's origin.
  const children = siblings.map((location) => ({
    ...location.element,
    x: location.element.x - bounds.x,
    y: location.element.y - bounds.y,
  }));

  const group = createGroup(bounds, children);
  const operations: Operation[] = [
    ...removeOperations(
      state,
      siblings.map((location) => location.element.id),
    ),
    {
      kind: "insert",
      parentId,
      index: siblings[0].index,
      element: group,
    },
  ];

  return {
    ...commit(state, operations, "Group"),
    selectedIds: [group.id],
  };
}

/** Re-expresses a child's box in its grandparent's space. */
function liftChild(
  child: DesignElement,
  containerMatrix: Matrix,
  containerRotation: number,
): DesignElement {
  const center = applyToPoint(containerMatrix, elementCenter(child));
  return {
    ...child,
    x: center.x - child.width / 2,
    y: center.y - child.height / 2,
    rotation: child.rotation + containerRotation,
  };
}

function ungroupSelection(state: EditorState): EditorState {
  const containers = selected(state).filter(isContainer);
  if (containers.length === 0) return state;

  const operations: Operation[] = [];
  const released: string[] = [];

  for (const container of containers) {
    const location = locateElement(state.document, container.id);
    if (!location) continue;

    const matrix = localMatrix(container);
    const children = childrenOf(container).map((child) =>
      liftChild(child, matrix, container.rotation),
    );

    const remove = createRemoveOperation(state.document, container.id);
    if (remove) operations.push(remove);

    children.forEach((child, offset) => {
      operations.push({
        kind: "insert",
        parentId: location.parentId,
        index: location.index + offset,
        element: child,
      });
      released.push(child.id);
    });
  }

  if (operations.length === 0) return state;
  return { ...commit(state, operations, "Ungroup"), selectedIds: released };
}

/* ------------------------------------------------------------------ *
 * Alignment
 * ------------------------------------------------------------------ */

/** Turns document-space offsets into patches in each element's own space. */
function offsetsToChanges(
  state: EditorState,
  offsets: readonly { id: string; dx: number; dy: number }[],
): ElementChange[] {
  return offsets.flatMap((offset) => {
    const element = locateElement(state.document, offset.id)?.element;
    if (!element) return [];
    const local = toParentDelta(state.document, offset.id, {
      x: offset.dx,
      y: offset.dy,
    });
    return [
      {
        id: offset.id,
        patch: { x: element.x + local.x, y: element.y + local.y },
      },
    ];
  });
}

function alignTargets(state: EditorState): AlignTarget[] {
  return selected(state).map((element) => ({
    id: element.id,
    bounds: subtreeBounds(state.document, element),
  }));
}

function alignSelection(state: EditorState, mode: AlignMode): EditorState {
  const targets = alignTargets(state);
  if (targets.length === 0) return state;

  // One element aligns to the canvas; several align to their shared bounds.
  const reference =
    targets.length === 1
      ? { x: 0, y: 0, width: state.document.width, height: state.document.height }
      : (selectionBounds(state.document, selected(state)) ?? null);
  if (!reference) return state;

  const changes = offsetsToChanges(
    state,
    alignElements(targets, reference, mode),
  );
  return transform(state, changes, null);
}

function distributeSelection(
  state: EditorState,
  axis: DistributeAxis,
): EditorState {
  const changes = offsetsToChanges(
    state,
    distributeElements(alignTargets(state), axis),
  );
  return transform(state, changes, null);
}

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "set-tool":
      return { ...state, tool: action.tool };

    case "select": {
      if (action.mode === "replace") {
        return {
          ...state,
          selectedIds: normalizeSelection(state.document, action.ids),
        };
      }
      const next = new Set(state.selectedIds);
      for (const id of action.ids) {
        if (action.mode === "toggle" && next.has(id)) next.delete(id);
        else next.add(id);
      }
      return {
        ...state,
        selectedIds: normalizeSelection(state.document, [...next]),
      };
    }

    case "add-element": {
      const placed = placeElement(state, action.element, action.at);
      const index = siblingsOf(state.document, placed.parentId).length;
      return {
        ...commit(
          state,
          [
            {
              kind: "insert",
              parentId: placed.parentId,
              index,
              element: placed.element,
            },
          ],
          "Add element",
        ),
        selectedIds: [placed.element.id],
        tool: "select",
      };
    }

    case "transform":
      return transform(state, action.changes, action.session, action.guides);

    case "patch-selection":
      return transform(
        state,
        state.selectedIds.map((id) => ({ id, patch: action.patch })),
        action.session,
      );

    case "patch-element":
      return transform(
        state,
        [{ id: action.id, patch: action.patch }],
        action.session,
      );

    case "nudge":
      return transform(
        state,
        selected(state).map((element) => ({
          id: element.id,
          patch: { x: element.x + action.dx, y: element.y + action.dy },
        })),
        null,
      );

    case "delete-selected": {
      const operations = removeOperations(state, state.selectedIds);
      return { ...commit(state, operations, "Delete"), selectedIds: [] };
    }

    case "reorder": {
      const location = locateElement(state.document, action.id);
      if (!location) return state;
      const count = siblingsOf(state.document, location.parentId).length;
      const to = targetLayerIndex(location.index, count, action.direction);
      const operation = createReorderOperation(state.document, action.id, to);
      return operation ? commit(state, [operation], "Reorder layer") : state;
    }

    case "group":
      return groupSelection(state);

    case "ungroup":
      return ungroupSelection(state);

    case "align":
      return alignSelection(state, action.mode);

    case "distribute":
      return distributeSelection(state, action.axis);

    case "copy": {
      const elements = selected(state);
      if (elements.length === 0) return state;
      return { ...state, clipboard: elements, pasteCount: 0 };
    }

    case "paste": {
      if (state.clipboard.length === 0) return state;
      const offset = PASTE_OFFSET * (state.pasteCount + 1);
      const copies = state.clipboard.map((element) => {
        const copy = cloneElementTree(element);
        return applyPatch(copy, { x: copy.x + offset, y: copy.y + offset });
      });
      return {
        ...insertElements(state, copies, "Paste"),
        pasteCount: state.pasteCount + 1,
      };
    }

    case "duplicate": {
      const copies = selected(state).map((element) => {
        const copy = cloneElementTree(element);
        return applyPatch(copy, {
          x: copy.x + PASTE_OFFSET,
          y: copy.y + PASTE_OFFSET,
        });
      });
      return insertElements(state, copies, "Duplicate");
    }

    case "undo": {
      const step = historyUndo(state.history);
      if (!step) return state;
      return applySilently(
        state,
        invertOperations(step.entry.ops),
        step.history,
      );
    }

    case "redo": {
      const step = historyRedo(state.history);
      if (!step) return state;
      return applySilently(state, step.entry.ops, step.history);
    }

    case "end-interaction":
      return state.guides.length === 0 ? state : { ...state, guides: [] };

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

/** True when the selection can be wrapped in a group. */
export function canGroup(state: EditorState): boolean {
  const ids = normalizeSelection(state.document, state.selectedIds);
  if (ids.length < 2) return false;
  const parents = ids.map(
    (id) => locateElement(state.document, id)?.parentId ?? null,
  );
  return parents.every((parentId) => parentId === parents[0]);
}

export function canUngroup(state: EditorState): boolean {
  return selected(state).some(isContainer);
}
