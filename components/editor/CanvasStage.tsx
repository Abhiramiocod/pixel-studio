"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DesignDocument, ElementPatch } from "@/models/design";
import type { Tool } from "@/editor/state";
import {
  clientToDesignPoint,
  fitViewport,
  type Point,
  type Size,
  type Viewport,
} from "@/engine/coordinates";
import { renderScene } from "@/engine/renderer";
import { hitTestHandle, pickElement } from "@/engine/transformations";
import {
  beginGesture,
  cursorForHandle,
  updateGesture,
  type Gesture,
} from "@/engine/interactions";

interface CanvasStageProps {
  document: DesignDocument;
  selectedId: string | null;
  tool: Tool;
  onSelect: (id: string | null) => void;
  onBeginTransaction: () => void;
  onTransform: (id: string, patch: ElementPatch, commit: boolean) => void;
  onInsertRectangle: (at: Point) => void;
  onInsertText: (at: Point) => void;
}

const EMPTY_SIZE: Size = { width: 0, height: 0 };

export function CanvasStage({
  document: doc,
  selectedId,
  tool,
  onSelect,
  onBeginTransaction,
  onTransform,
  onInsertRectangle,
  onInsertText,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [size, setSize] = useState<Size>(EMPTY_SIZE);

  // Keep the canvas backing store in sync with its CSS box.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const viewport: Viewport = useMemo(
    () => fitViewport(size, { width: doc.width, height: doc.height }),
    [size, doc.width, doc.height],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderScene(ctx, {
      document: doc,
      selectedId,
      viewport,
      size,
      devicePixelRatio: dpr,
    });
  }, [doc, selectedId, size, viewport]);

  const designPointFromEvent = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return clientToDesignPoint(canvas, event.clientX, event.clientY, viewport);
    },
    [viewport],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = designPointFromEvent(event);
    if (!point) return;

    if (tool === "rectangle") {
      onInsertRectangle(point);
      return;
    }
    if (tool === "text") {
      onInsertText(point);
      return;
    }

    const selected = doc.elements.find((element) => element.id === selectedId);

    // A press on the selection chrome resizes or rotates, even outside the body.
    if (selected && hitTestHandle(selected, point, viewport.zoom) !== null) {
      onBeginTransaction();
      gestureRef.current = beginGesture(selected, point, viewport.zoom);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const hit = pickElement(doc.elements, point);
    onSelect(hit?.id ?? null);
    if (!hit) return;

    onBeginTransaction();
    gestureRef.current = beginGesture(hit, point, viewport.zoom);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = designPointFromEvent(event);
    if (!point) return;

    const gesture = gestureRef.current;
    if (!gesture) {
      updateCursor(event.currentTarget, point);
      return;
    }

    const element = doc.elements.find((item) => item.id === gesture.elementId);
    if (!element) return;

    onTransform(element.id, updateGesture(gesture, element, point), false);
  };

  const updateCursor = (canvas: HTMLCanvasElement, point: Point) => {
    if (tool !== "select") {
      canvas.style.cursor = "crosshair";
      return;
    }
    const selected = doc.elements.find((element) => element.id === selectedId);
    const handle = selected
      ? hitTestHandle(selected, point, viewport.zoom)
      : null;
    if (handle) {
      canvas.style.cursor = cursorForHandle(handle);
      return;
    }
    canvas.style.cursor = pickElement(doc.elements, point) ? "move" : "default";
  };

  const endGesture = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!gestureRef.current) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-zinc-200"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        style={{ width: size.width, height: size.height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      />
      <div className="pointer-events-none absolute bottom-3 right-4 rounded bg-white/80 px-2 py-1 text-xs text-zinc-600 tabular-nums">
        {doc.width} x {doc.height} - {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}
