"use client";

/** Insert palette: shapes, text, frames and image upload. */

import type {
  ShapeKind,
} from "@pixel-studio/types";
import { SHAPE_LABELS } from "@/models/elements";

export interface InsertHandlers {
  onInsertShape: (kind: ShapeKind) => void;
  onInsertText: () => void;
  onInsertFrame: () => void;
  onRequestImage: () => void;
}

const SHAPE_ORDER: readonly ShapeKind[] = [
  "rectangle",
  "ellipse",
  "triangle",
  "polygon",
  "star",
  "line",
  "arrow",
];

export function ElementsPanel({
  onInsertShape,
  onInsertText,
  onInsertFrame,
  onRequestImage,
}: InsertHandlers) {
  return (
    <section className="flex flex-col gap-2 border-b border-zinc-200 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Elements
      </h2>

      <div className="grid grid-cols-2 gap-1">
        {SHAPE_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onInsertShape(kind)}
            className="rounded border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-800 hover:bg-zinc-50"
          >
            {SHAPE_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={onInsertText}
          className="rounded border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-800 hover:bg-zinc-50"
        >
          Text
        </button>
        <button
          type="button"
          onClick={onInsertFrame}
          className="rounded border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-800 hover:bg-zinc-50"
        >
          Frame
        </button>
        <button
          type="button"
          onClick={onRequestImage}
          className="col-span-2 rounded border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-800 hover:bg-zinc-50"
        >
          Upload image…
        </button>
      </div>

      <p className="text-[11px] text-zinc-400">
        Inserts at the canvas centre. Pick a tool in the toolbar to place by
        clicking.
      </p>
    </section>
  );
}
