"use client";

import {
  elementLabel,
  type DesignElement,
  type LayerDirection,
} from "@/models/design";

interface LayersPanelProps {
  /** Document order: index 0 is the back of the stack. */
  elements: readonly DesignElement[];
  selectedIds: readonly string[];
  onSelect: (id: string, additive: boolean) => void;
  onReorder: (id: string, direction: LayerDirection) => void;
}

const REORDER_ACTIONS: ReadonlyArray<{
  direction: LayerDirection;
  label: string;
  title: string;
}> = [
  { direction: "front", label: "⤒", title: "Bring to front" },
  { direction: "forward", label: "↑", title: "Bring forward" },
  { direction: "backward", label: "↓", title: "Send backward" },
  { direction: "back", label: "⤓", title: "Send to back" },
];

export function LayersPanel({
  elements,
  selectedIds,
  onSelect,
  onReorder,
}: LayersPanelProps) {
  // Rendered top-most first, which is the reverse of document order.
  const topDown = [...elements].reverse();
  const soleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Layers
        </h2>
        <div className="flex gap-0.5">
          {REORDER_ACTIONS.map((action) => (
            <button
              key={action.direction}
              type="button"
              title={action.title}
              aria-label={action.title}
              disabled={soleSelectedId === null}
              onClick={() =>
                soleSelectedId && onReorder(soleSelectedId, action.direction)
              }
              className="h-6 w-6 rounded text-sm leading-none text-zinc-600 hover:bg-zinc-100 disabled:text-zinc-300 disabled:hover:bg-transparent"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {elements.length === 0 ? (
        <p className="text-xs text-zinc-400">Nothing on the canvas yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {topDown.map((element) => (
            <li key={element.id}>
              <button
                type="button"
                onClick={(event) => onSelect(element.id, event.shiftKey)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  selectedIds.includes(element.id)
                    ? "bg-blue-50 text-blue-700"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span aria-hidden className="text-zinc-400">
                  ☰
                </span>
                <span className="truncate">{elementLabel(element)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
