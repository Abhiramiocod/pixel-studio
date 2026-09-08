"use client";

import type { Tool } from "@/editor/state";

interface ElementsPanelProps {
  onAdd: (tool: Exclude<Tool, "select">) => void;
}

const ELEMENTS: ReadonlyArray<{ tool: Exclude<Tool, "select">; label: string }> =
  [
    { tool: "rectangle", label: "Rectangle" },
    { tool: "text", label: "Text" },
  ];

export function ElementsPanel({ onAdd }: ElementsPanelProps) {
  return (
    <section className="flex flex-col gap-2 border-b border-zinc-200 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Elements
      </h2>
      {ELEMENTS.map((entry) => (
        <button
          key={entry.tool}
          type="button"
          onClick={() => onAdd(entry.tool)}
          className="rounded border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
        >
          {entry.label}
        </button>
      ))}
      <p className="text-xs text-zinc-400">
        Adds to the canvas centre. Pick a tool above to place by clicking.
      </p>
    </section>
  );
}
