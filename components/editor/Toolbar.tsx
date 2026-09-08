"use client";

import type { Tool } from "@/editor/state";

interface ToolbarProps {
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const TOOLS: ReadonlyArray<{ id: Tool; label: string }> = [
  { id: "select", label: "Select" },
  { id: "rectangle", label: "Rectangle" },
  { id: "text", label: "Text" },
];

export function Toolbar({
  tool,
  canUndo,
  canRedo,
  onToolChange,
  onUndo,
  onRedo,
}: ToolbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-4">
      <span className="text-sm font-semibold text-zinc-900">Pixel Studio</span>

      <div className="flex items-center gap-1">
        {TOOLS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onToolChange(entry.id)}
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
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ToolbarButton label="Undo" disabled={!canUndo} onClick={onUndo} />
        <ToolbarButton label="Redo" disabled={!canRedo} onClick={onRedo} />
      </div>
    </header>
  );
}

function ToolbarButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}
