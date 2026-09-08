"use client";

/**
 * The canvas surface.
 *
 * This component owns nothing about *what* the design is: it converts pointer
 * and wheel input into document-space coordinates, asks the engine what a
 * gesture means, and hands the result to the editor store. Rendering is
 * delegated to the engine's `renderScene`.
 */

import type {
  ShapeKind,
} from "@pixel-studio/types";
import { useCallback, useEffect, useRef, useState } from "react";

import type { EditorApi } from "@/editor/useEditor";
import {
  clientToDocumentPoint,
  clientToScreenPoint,
  screenToDocument,
  type Camera,
  type Point,
  type Size,
} from "@/engine/coordinates";
import { renderScene } from "@/engine/rendering/renderer";
import { pickDeepest, resolveSelection } from "@/engine/selection";
import { hitTestHandle } from "@/engine/transformations";
import {
  beginGesture,
  cursorForHandle,
  updateGesture,
  type Gesture,
} from "@/engine/interactions";
import { onImageLoaded } from "@/engine/images/imageCache";

interface CanvasStageProps {
  editor: EditorApi;
  shapeKind: ShapeKind;
}

/** Identifies one continuous drag so history folds it into a single undo step. */
let gestureSession = 0;

const MIDDLE_MOUSE_BUTTON = 1;

export function CanvasStage({ editor, shapeKind }: CanvasStageProps) {
  const { document: doc, selectedIds, camera, tool, guides } = editor.state;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<{ gesture: Gesture; session: string } | null>(null);
  const panRef = useRef<{ origin: Point; camera: Camera } | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [imageEpoch, setImageEpoch] = useState(0);

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

  // Images decode asynchronously; repaint when one becomes available.
  useEffect(() => onImageLoaded(() => setImageEpoch((epoch) => epoch + 1)), []);

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
        guides,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [doc, selectedIds, camera, size, guides, imageEpoch]);

  // Wheel: pinch/ctrl zooms about the cursor, everything else pans.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        zoomByFactor(Math.exp(-event.deltaY / 300), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      } else {
        panViewport(-event.deltaX, -event.deltaY);
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomByFactor, panViewport]);

  const documentPoint = useCallback(
    (event: { clientX: number; clientY: number }): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return clientToDocumentPoint(canvas, event.clientX, event.clientY, camera);
    },
    [camera],
  );

  const insertAt = (point: Point) => {
    switch (tool) {
      case "shape":
        editor.insertShape(shapeKind, point);
        return true;
      case "text":
        editor.insertText(point);
        return true;
      case "frame":
        editor.insertFrame(point);
        return true;
      case "select":
        return false;
    }
  };

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
    if (insertAt(point)) return;

    const selection = editor.selectedElements;

    // A press on the transform handles wins, even outside the element body.
    if (
      selection.length === 1 &&
      hitTestHandle(doc, selection[0], point, camera.zoom) !== null
    ) {
      startGesture(selection, point, canvas, event.pointerId);
      return;
    }

    const hit = pickDeepest(doc, point, camera.zoom);
    if (!hit) {
      editor.clearSelection();
      return;
    }

    // A plain click selects the outermost container; a double-click reaches in.
    const target = resolveSelection(doc, hit, event.detail >= 2);

    if (event.shiftKey) {
      editor.selectOne(target.id, true);
      return;
    }

    const alreadySelected = selectedIds.includes(target.id);
    if (!alreadySelected) editor.selectOne(target.id);

    startGesture(
      alreadySelected ? selection : [target],
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
    const gesture = beginGesture(doc, elements, point, camera.zoom);
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

    const result = updateGesture(doc, active.gesture, point, {
      zoom: camera.zoom,
      // Alt temporarily disables snapping, as in other design tools.
      snapping: !event.altKey,
    });
    if (result.changes.length > 0) {
      editor.transform(result.changes, active.session, result.guides);
    }
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
    const selection = editor.selectedElements;
    const handle =
      selection.length === 1
        ? hitTestHandle(doc, selection[0], point, camera.zoom)
        : null;
    if (handle) {
      canvas.style.cursor = cursorForHandle(handle);
      return;
    }
    canvas.style.cursor = pickDeepest(doc, point, camera.zoom)
      ? "move"
      : "default";
  };

  const endInteraction = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const hadGesture = gestureRef.current !== null;
    gestureRef.current = null;
    panRef.current = null;
    if (hadGesture) editor.endInteraction();
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
      <ViewportHint camera={camera} size={size} width={doc.width} height={doc.height} />
    </div>
  );
}

/** Read-out of the artboard size and the document point at the viewport centre. */
function ViewportHint({
  camera,
  size,
  width,
  height,
}: {
  camera: Camera;
  size: Size;
  width: number;
  height: number;
}) {
  const center = screenToDocument(
    { x: size.width / 2, y: size.height / 2 },
    camera,
  );
  return (
    <div className="pointer-events-none absolute bottom-3 right-4 rounded bg-white/80 px-2 py-1 text-xs text-zinc-600 tabular-nums">
      {width} x {height} - center {Math.round(center.x)}, {Math.round(center.y)}
    </div>
  );
}
