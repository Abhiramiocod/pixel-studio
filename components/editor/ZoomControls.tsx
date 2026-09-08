"use client";

import { ZOOM_PRESETS } from "@/engine/coordinates";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (zoom: number) => void;
  onZoomToFit: () => void;
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomTo,
  onZoomToFit,
}: ZoomControlsProps) {
  const percent = Math.round(zoom * 100);
  // The current zoom may sit between presets (wheel zoom, fit), so it is offered
  // as an extra option rather than being snapped.
  const options = ZOOM_PRESETS.includes(zoom)
    ? ZOOM_PRESETS
    : [...ZOOM_PRESETS, zoom].sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="h-7 w-7 rounded text-sm text-zinc-700 hover:bg-zinc-100"
      >
        −
      </button>

      <select
        value={zoom}
        onChange={(event) => onZoomTo(Number(event.target.value))}
        aria-label="Zoom level"
        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 tabular-nums"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {Math.round(option * 100)}%
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="h-7 w-7 rounded text-sm text-zinc-700 hover:bg-zinc-100"
      >
        +
      </button>

      <button
        type="button"
        onClick={onZoomToFit}
        className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
      >
        Fit
      </button>

      <span className="w-12 text-right text-xs text-zinc-500 tabular-nums">
        {percent}%
      </span>
    </div>
  );
}
