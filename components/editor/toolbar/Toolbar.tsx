"use client";

/**
 * Top toolbar. Tools on the left, selection-dependent actions in the middle,
 * history and export on the right.
 */

import { SHAPE_LABELS, type ShapeKind } from "@/models/elements";
import type { LayerDirection } from "@/models/design";
import type { Tool } from "@/editor/state";
import type { EditorApi } from "@/editor/useEditor";
import { formatShortcut } from "@/utils/keyboard";

interface ToolbarProps {
  editor: EditorApi;
  shapeKind: ShapeKind;
  onShapeKindChange: (kind: ShapeKind) => void;
  onRequestImage: () => void;
}

const TOOLS: ReadonlyArray<{ id: Tool; label: string }> = [
  { id: "select", label: "Select" },
  { id: "shape", label: "Shape" },
  { id: "text", label: "Text" },
  { id: "frame", label: "Frame" },
];

const ARRANGE: ReadonlyArray<{ direction: LayerDirection; label: string }> = [
  { direction: "front", label: "Front" },
  { direction: "forward", label: "Forward" },
  { direction: "backward", label: "Backward" },
  { direction: "back", label: "Back" },
];

export function Toolbar({
  editor,
  shapeKind,
  onShapeKindChange,
  onRequestImage,
}: ToolbarProps) {
  const { tool, selectedIds } = editor.state;
  const soleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-b border-zinc-200 bg-white px-4">
      <span className="shrink-0 text-sm font-semibold text-zinc-900">
        Pixel Studio
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {TOOLS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => editor.setTool(entry.id)}
            aria-pressed={tool === entry.id}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              tool === entry.id
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {entry.label}
          </button>
        ))}

        <select
          value={shapeKind}
          aria-label="Shape kind"
          onChange={(event) => {
            onShapeKindChange(event.target.value as ShapeKind);
            editor.setTool("shape");
          }}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
        >
          {(Object.keys(SHAPE_LABELS) as ShapeKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {SHAPE_LABELS[kind]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRequestImage}
          className="rounded px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          Image
        </button>
      </div>

      <span className="h-6 w-px shrink-0 bg-zinc-200" />

      <div className="flex shrink-0 items-center gap-1">
        <ToolbarButton
          label="Group"
          title={`Group (${formatShortcut({ key: "g", mod: true })})`}
          disabled={!editor.canGroup}
          onClick={editor.group}
        />
        <ToolbarButton
          label="Ungroup"
          title={`Ungroup (${formatShortcut({ key: "g", mod: true, shift: true })})`}
          disabled={!editor.canUngroup}
          onClick={editor.ungroup}
        />
        {ARRANGE.map((entry) => (
          <ToolbarButton
            key={entry.direction}
            label={entry.label}
            title={`Send ${entry.label.toLowerCase()}`}
            disabled={soleSelectedId === null}
            onClick={() =>
              soleSelectedId && editor.reorder(soleSelectedId, entry.direction)
            }
          />
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ToolbarButton
          label="Undo"
          title={`Undo (${formatShortcut({ key: "z", mod: true })})`}
          disabled={!editor.canUndo}
          onClick={editor.undo}
        />
        <ToolbarButton
          label="Redo"
          title={`Redo (${formatShortcut({ key: "z", mod: true, shift: true })})`}
          disabled={!editor.canRedo}
          onClick={editor.redo}
        />
        <button
          type="button"
          disabled
          title="Export arrives in a later milestone"
          className="rounded border border-dashed border-zinc-200 px-3 py-1.5 text-sm text-zinc-400"
        >
          Export
        </button>
      </div>
    </header>
  );
}

function ToolbarButton({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}
