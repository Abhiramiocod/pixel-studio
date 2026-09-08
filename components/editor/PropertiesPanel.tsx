"use client";

import type { DesignElement, ElementPatch } from "@/models/design";

interface PropertiesPanelProps {
  element: DesignElement | null;
  onChange: (patch: ElementPatch) => void;
  onDelete: () => void;
}

export function PropertiesPanel({
  element,
  onChange,
  onDelete,
}: PropertiesPanelProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 border-l border-zinc-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Properties
      </h2>

      {element === null ? (
        <p className="text-xs text-zinc-400">
          Select an element to edit its properties.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="X"
              value={element.x}
              onChange={(x) => onChange({ x })}
            />
            <NumberField
              label="Y"
              value={element.y}
              onChange={(y) => onChange({ y })}
            />
            <NumberField
              label="W"
              value={element.width}
              min={1}
              onChange={(width) => onChange({ width })}
            />
            <NumberField
              label="H"
              value={element.height}
              min={1}
              onChange={(height) => onChange({ height })}
            />
            <NumberField
              label="Rotation"
              value={Math.round(element.rotation)}
              onChange={(rotation) => onChange({ rotation })}
            />
            <NumberField
              label="Opacity"
              value={Number(element.opacity.toFixed(2))}
              min={0}
              max={1}
              step={0.05}
              onChange={(opacity) => onChange({ opacity })}
            />
          </div>

          {element.type === "rectangle" && (
            <ColorField
              label="Fill"
              value={element.fill}
              onChange={(fill) => onChange({ fill })}
            />
          )}

          {element.type === "text" && (
            <>
              <label className="flex flex-col gap-1 text-xs text-zinc-500">
                Text
                <input
                  type="text"
                  value={element.text}
                  onChange={(event) => onChange({ text: event.target.value })}
                  className="rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900"
                />
              </label>
              <NumberField
                label="Font size"
                value={element.fontSize}
                min={4}
                onChange={(fontSize) => onChange({ fontSize })}
              />
              <ColorField
                label="Color"
                value={element.color}
                onChange={(color) => onChange({ color })}
              />
            </>
          )}

          <button
            type="button"
            onClick={onDelete}
            className="mt-auto rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete element
          </button>
        </>
      )}
    </aside>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
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
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 tabular-nums"
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
