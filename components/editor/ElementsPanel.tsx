"use client";

import type { DesignElement } from "@/models/design";

interface ElementsPanelProps {
  elements: readonly DesignElement[];
  selectedId: string | null;
  onAddRectangle: () => void;
  onAddText: () => void;
  onSelect: (id: string) => void;
}

export function ElementsPanel({
  elements,
  selectedId,
  onAddRectangle,
  onAddText,
  onSelect,
}: ElementsPanelProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-4 border-r border-zinc-200 bg-white p-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Elements
        </h2>
        <button
          type="button"
          onClick={onAddRectangle}
          className="rounded border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
        >
          Rectangle
        </button>
        <button
          type="button"
          onClick={onAddText}
          className="rounded border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
        >
          Text
        </button>
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Layers
        </h2>
        {elements.length === 0 ? (
          <p className="text-xs text-zinc-400">Nothing on the canvas yet.</p>
        ) : (
          <ul className="flex flex-col-reverse gap-1 overflow-y-auto">
            {elements.map((element) => (
              <li key={element.id}>
                <button
                  type="button"
                  onClick={() => onSelect(element.id)}
                  className={`w-full truncate rounded px-2 py-1.5 text-left text-sm ${
                    element.id === selectedId
                      ? "bg-blue-50 text-blue-700"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {element.type === "text" ? element.text : "Rectangle"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
