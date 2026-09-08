"use client";

import type { DesignElement, ElementPatch } from "@/models/design";

interface PropertiesPanelProps {
  element: DesignElement | null;
  /** Number of currently selected elements, used for the empty states. */
  selectionCount: number;
  /**
   * `session` groups rapid edits to the same field into one undo step; a
   * different field starts a new one.
   */
  onChange: (patch: ElementPatch, session: string | null) => void;
  onDelete: () => void;
}

export function PropertiesPanel({
  element,
  selectionCount,
  onChange,
  onDelete,
}: PropertiesPanelProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Properties
      </h2>

      {element === null ? (
        <p className="text-xs text-zinc-400">
          {selectionCount > 1
            ? `${selectionCount} elements selected. Select a single element to edit its properties.`
            : "Select an element to edit its properties."}
        </p>
      ) : (
        <ElementProperties
          element={element}
          onChange={onChange}
          onDelete={onDelete}
        />
      )}
    </aside>
  );
}

function ElementProperties({
  element,
  onChange,
  onDelete,
}: {
  element: DesignElement;
  onChange: (patch: ElementPatch, session: string | null) => void;
  onDelete: () => void;
}) {
  const session = (field: string) => `property:${element.id}:${field}`;

  return (
    <>
      <Group title="Position">
        <NumberField
          label="X"
          value={Math.round(element.x)}
          onChange={(x) => onChange({ x }, session("x"))}
        />
        <NumberField
          label="Y"
          value={Math.round(element.y)}
          onChange={(y) => onChange({ y }, session("y"))}
        />
      </Group>

      <Group title="Size">
        <NumberField
          label="Width"
          value={Math.round(element.width)}
          min={1}
          onChange={(width) => onChange({ width }, session("width"))}
        />
        <NumberField
          label="Height"
          value={Math.round(element.height)}
          min={1}
          onChange={(height) => onChange({ height }, session("height"))}
        />
      </Group>

      <Group title="Transform">
        <NumberField
          label="Rotation"
          value={Math.round(element.rotation)}
          onChange={(rotation) => onChange({ rotation }, session("rotation"))}
        />
        <NumberField
          label="Opacity %"
          value={Math.round(element.opacity * 100)}
          min={0}
          max={100}
          onChange={(value) =>
            onChange({ opacity: value / 100 }, session("opacity"))
          }
        />
      </Group>

      {element.type === "rectangle" && (
        <Group title="Appearance" columns={1}>
          <ColorField
            label="Fill"
            value={element.fill}
            onChange={(fill) => onChange({ fill }, session("fill"))}
          />
        </Group>
      )}

      {element.type === "text" && (
        <Group title="Text" columns={1}>
          <TextField
            label="Content"
            value={element.text}
            onChange={(text) => onChange({ text }, session("text"))}
          />
          <NumberField
            label="Font size"
            value={element.fontSize}
            min={4}
            onChange={(fontSize) => onChange({ fontSize }, session("fontSize"))}
          />
          <TextField
            label="Font family"
            value={element.fontFamily}
            onChange={(fontFamily) =>
              onChange({ fontFamily }, session("fontFamily"))
            }
          />
          <ColorField
            label="Color"
            value={element.color}
            onChange={(color) => onChange({ color }, session("color"))}
          />
        </Group>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="mt-2 rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
      >
        Delete element
      </button>
    </>
  );
}

function Group({
  title,
  columns = 2,
  children,
}: {
  title: string;
  columns?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      <div
        className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {children}
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 tabular-nums"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-zinc-500">
      {label}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-16 cursor-pointer rounded border border-zinc-200 bg-white"
      />
    </label>
  );
}
