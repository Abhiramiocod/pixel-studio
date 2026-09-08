"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DesignDocument } from "@/models/design";
import type { EditorApi } from "@/editor/useEditor";
import {
  clientToDocumentPoint,
  clientToScreenPoint,
  screenToDocument,
  type Camera,
  type Point,
  type Size,
} from "@/engine/coordinates";
import { renderScene } from "@/engine/renderer";
import { pickElement } from "@/engine/selection";
import { hitTestHandle } from "@/engine/transformations";
import {
  beginGesture,
  cursorForHandle,
  updateGesture,
  type Gesture,
} from "@/engine/interactions";

interface CanvasStageProps {
  editor: EditorApi;
}

/** Identifies one continuous drag so history folds it into a single undo step. */
let gestureSession = 0;

const MIDDLE_MOUSE_BUTTON = 1;

export function CanvasStage({ editor }: CanvasStageProps) {
  const { document: doc, selectedIds, camera, tool } = editor.state;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<{ gesture: Gesture; session: string } | null>(null);
  const panRef = useRef<{ origin: Point; camera: Camera } | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);

  const { viewportResized, zoomByFactor, panViewport } = editor;

  // Keep the canvas backing store in sync with its CSS box.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const next = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      setSize(next);
      viewportResized(next);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewportResized]);

  // Space enables temporary pan mode, as in most design tools.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat) setSpaceHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Draw on the next animation frame so bursts of pointer moves coalesce.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;

    const frame = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(size.width * dpr);
      const height = Math.round(size.height * dpr);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderScene(ctx, {
        document: doc,
        selectedIds,
        camera,
        size,
        devicePixelRatio: dpr,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [doc, selectedIds, camera, size]);

  // Wheel: pinch/ctrl zooms about the cursor, everything else pans.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        zoomByFactor(Math.exp(-event.deltaY / 300), {
          x: event.clientX - canvas.getBoundingClientRect().left,
          y: event.clientY - canvas.getBoundingClientRect().top,
        });
      } else {
        panViewport(-event.deltaX, -event.deltaY);
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomByFactor, panViewport]);

  const documentPoint = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return clientToDocumentPoint(canvas, event.clientX, event.clientY, camera);
    },
    [camera],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;

    if (spaceHeld || event.button === MIDDLE_MOUSE_BUTTON) {
      panRef.current = {
        origin: clientToScreenPoint(canvas, event.clientX, event.clientY),
        camera,
      };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;

    const point = documentPoint(event);
    if (!point) return;

    if (tool === "rectangle") {
      editor.insertRectangle(point);
      return;
    }
    if (tool === "text") {
      editor.insertText(point);
      return;
    }

    const selected = editor.selectedElements;

    // A press on the transform handles wins, even outside the element body.
    if (
      selected.length === 1 &&
      hitTestHandle(selected[0], point, camera.zoom) !== null
    ) {
      startGesture(selected, point, canvas, event.pointerId);
      return;
    }

    const hit = pickElement(doc.elements, point);
    if (!hit) {
      editor.clearSelection();
      return;
    }

    const additive = event.shiftKey;
    const alreadySelected = selectedIds.includes(hit.id);

    if (additive) {
      editor.selectOne(hit.id, true);
      return;
    }
    if (!alreadySelected) editor.selectOne(hit.id);

    // Dragging moves the whole selection when the press lands inside it.
    startGesture(
      alreadySelected ? selected : [hit],
      point,
      canvas,
      event.pointerId,
    );
  };

  const startGesture = (
    elements: EditorApi["selectedElements"],
    point: Point,
    canvas: HTMLCanvasElement,
    pointerId: number,
  ) => {
    const gesture = beginGesture(elements, point, camera.zoom);
    if (!gesture) return;
    gestureSession += 1;
    gestureRef.current = { gesture, session: `gesture-${gestureSession}` };
    canvas.setPointerCapture(pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;

    const pan = panRef.current;
    if (pan) {
      const current = clientToScreenPoint(canvas, event.clientX, event.clientY);
      editor.setCamera({
        ...pan.camera,
        panX: pan.camera.panX + (current.x - pan.origin.x),
        panY: pan.camera.panY + (current.y - pan.origin.y),
      });
      return;
    }

    const point = documentPoint(event);
    if (!point) return;

    const active = gestureRef.current;
    if (!active) {
      updateCursor(canvas, point);
      return;
    }

    const changes = updateGesture(active.gesture, doc.elements, point);
    if (changes.length > 0) editor.transform(changes, active.session);
  };

  const updateCursor = (canvas: HTMLCanvasElement, point: Point) => {
    if (spaceHeld) {
      canvas.style.cursor = "grab";
      return;
    }
    if (tool !== "select") {
      canvas.style.cursor = "crosshair";
      return;
    }
    const selected = editor.selectedElements;
    const handle =
      selected.length === 1
        ? hitTestHandle(selected[0], point, camera.zoom)
        : null;
    if (handle) {
      canvas.style.cursor = cursorForHandle(handle);
      return;
    }
    canvas.style.cursor = pickElement(doc.elements, point) ? "move" : "default";
  };

  const endInteraction = (event: React.PointerEvent<HTMLCanvasElement>) => {
    gestureRef.current = null;
    panRef.current = null;
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
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onContextMenu={(event) => event.preventDefault()}
      />
      <ViewportHint camera={camera} document={doc} size={size} />
    </div>
  );
}

/** Small read-out of the document size and the document point under the centre. */
function ViewportHint({
  camera,
  document: doc,
  size,
}: {
  camera: Camera;
  document: DesignDocument;
  size: Size;
}) {
  const center = screenToDocument(
    { x: size.width / 2, y: size.height / 2 },
    camera,
  );
  return (
    <div className="pointer-events-none absolute bottom-3 right-4 rounded bg-white/80 px-2 py-1 text-xs text-zinc-600 tabular-nums">
      {doc.width} x {doc.height} - center {Math.round(center.x)},{" "}
      {Math.round(center.y)}
    </div>
  );
}
