/**
 * Editor state and reducer.
 *
 * Every mutation goes through a single `EditorAction`, which keeps the door open
 * for a richer command/history system later. History is snapshot based for now:
 * an action either commits (pushing the previous document onto the undo stack)
 * or is transient, which is what a drag needs so one gesture is one undo step.
 */

import {
  addElement,
  createDocument,
  removeElement,
  updateElement,
  type DesignDocument,
  type DesignElement,
  type ElementPatch,
} from "@/models/design";

export type Tool = "select" | "rectangle" | "text";

export interface EditorState {
  document: DesignDocument;
  selectedId: string | null;
  tool: Tool;
  past: DesignDocument[];
  future: DesignDocument[];
}

export type EditorAction =
  | { type: "set-tool"; tool: Tool }
  | { type: "select"; id: string | null }
  | { type: "add-element"; element: DesignElement }
  | { type: "update-element"; id: string; patch: ElementPatch; commit: boolean }
  | { type: "delete-element"; id: string }
  /** Snapshots the document before an interactive gesture (drag/resize/rotate). */
  | { type: "begin-transaction" }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 50;

export function createInitialState(): EditorState {
  return {
    document: createDocument(),
    selectedId: null,
    tool: "select",
    past: [],
    future: [],
  };
}

function pushHistory(state: EditorState): Pick<EditorState, "past" | "future"> {
  const past = [...state.past, state.document];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past,
    future: [],
  };
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "set-tool":
      return { ...state, tool: action.tool };

    case "select":
      return { ...state, selectedId: action.id };

    case "add-element":
      return {
        ...state,
        ...pushHistory(state),
        document: addElement(state.document, action.element),
        selectedId: action.element.id,
        tool: "select",
      };

    case "update-element": {
      const history = action.commit
        ? pushHistory(state)
        : { past: state.past, future: state.future };
      return {
        ...state,
        ...history,
        document: updateElement(state.document, action.id, action.patch),
      };
    }

    case "delete-element":
      return {
        ...state,
        ...pushHistory(state),
        document: removeElement(state.document, action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case "begin-transaction":
      return { ...state, ...pushHistory(state) };

    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future],
        selectedId: keepSelection(previous, state.selectedId),
      };
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        ...state,
        document: next,
        past: [...state.past, state.document],
        future: rest,
        selectedId: keepSelection(next, state.selectedId),
      };
    }
  }
}

/** Drops the selection when the element no longer exists in `doc`. */
function keepSelection(doc: DesignDocument, id: string | null): string | null {
  if (id === null) return null;
  return doc.elements.some((element) => element.id === id) ? id : null;
}

export function canUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: EditorState): boolean {
  return state.future.length > 0;
}
