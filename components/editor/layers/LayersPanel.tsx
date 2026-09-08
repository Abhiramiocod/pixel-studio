"use client";

/**
 * Hierarchical layers panel.
 *
 * The document is the only source of truth: rows are derived from the element
 * tree on every render, and the panel's own state is limited to which
 * containers are expanded.
 */

import { useState } from "react";

import {
  childrenOf,
  elementLabel,
  isContainer,
  type DesignElement,
} from "@/models/elements";
import type { LayerDirection } from "@/models/design";
import type { EditorApi } from "@/editor/useEditor";

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

export function LayersPanel({ editor }: { editor: EditorApi }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const { document: doc, selectedIds } = editor.state;
  const soleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  const toggleCollapsed = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
                soleSelectedId && editor.reorder(soleSelectedId, action.direction)
              }
              className="h-6 w-6 rounded text-sm leading-none text-zinc-600 hover:bg-zinc-100 disabled:text-zinc-300 disabled:hover:bg-transparent"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {doc.elements.length === 0 ? (
        <p className="text-xs text-zinc-400">Nothing on the canvas yet.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LayerList
            elements={doc.elements}
            depth={0}
            editor={editor}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        </div>
      )}
    </section>
  );
}

function LayerList({
  elements,
  depth,
  editor,
  collapsed,
  onToggleCollapsed,
}: {
  elements: readonly DesignElement[];
  depth: number;
  editor: EditorApi;
  collapsed: ReadonlySet<string>;
  onToggleCollapsed: (id: string) => void;
}) {
  // Top-most first, which is the reverse of document order.
  const topDown = [...elements].reverse();

  return (
    <ul className="flex flex-col gap-0.5">
      {topDown.map((element) => (
        <li key={element.id}>
          <LayerRow
            element={element}
            depth={depth}
            editor={editor}
            expanded={!collapsed.has(element.id)}
            onToggleCollapsed={onToggleCollapsed}
          />
          {isContainer(element) && !collapsed.has(element.id) && (
            <LayerList
              elements={childrenOf(element)}
              depth={depth + 1}
              editor={editor}
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function LayerRow({
  element,
  depth,
  editor,
  expanded,
  onToggleCollapsed,
}: {
  element: DesignElement;
  depth: number;
  editor: EditorApi;
  expanded: boolean;
  onToggleCollapsed: (id: string) => void;
}) {
  const selected = editor.state.selectedIds.includes(element.id);
  const container = isContainer(element);

  return (
    <div
      className={`flex items-center gap-1 rounded pr-1 text-sm ${
        selected ? "bg-blue-50 text-blue-700" : "text-zinc-700 hover:bg-zinc-50"
      }`}
      style={{ paddingLeft: depth * 12 }}
    >
      <button
        type="button"
        aria-label={container ? (expanded ? "Collapse" : "Expand") : undefined}
        disabled={!container}
        onClick={() => onToggleCollapsed(element.id)}
        className="h-6 w-5 shrink-0 text-xs text-zinc-400 disabled:opacity-0"
      >
        {expanded ? "▾" : "▸"}
      </button>

      <button
        type="button"
        onClick={(event) => editor.selectOne(element.id, event.shiftKey)}
        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
      >
        <span aria-hidden className="text-zinc-400">
          {container ? "▣" : "☰"}
        </span>
        <span
          className={`truncate ${element.visible ? "" : "text-zinc-400 line-through"}`}
        >
          {elementLabel(element)}
        </span>
      </button>

      <button
        type="button"
        title={element.visible ? "Hide" : "Show"}
        aria-label={element.visible ? "Hide layer" : "Show layer"}
        onClick={() =>
          editor.patchElement(element.id, { visible: !element.visible })
        }
        className="h-6 w-6 shrink-0 text-xs text-zinc-400 hover:text-zinc-700"
      >
        {element.visible ? "◉" : "○"}
      </button>

      <button
        type="button"
        title={element.locked ? "Unlock" : "Lock"}
        aria-label={element.locked ? "Unlock layer" : "Lock layer"}
        onClick={() =>
          editor.patchElement(element.id, { locked: !element.locked })
        }
        className="h-6 w-6 shrink-0 text-xs text-zinc-400 hover:text-zinc-700"
      >
        {element.locked ? "🔒" : "🔓"}
      </button>
    </div>
  );
}
