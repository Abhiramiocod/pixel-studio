/**
 * Canvas rendering.
 *
 * The renderer is a pure function of (document, selection, camera): it never
 * reads React state and never mutates the model. Elements are drawn in document
 * coordinates under the camera transform; selection chrome is drawn afterwards
 * in screen space so outlines and handles keep a constant size at any zoom.
 */

import type { DesignDocument, DesignElement } from "@/models/design";
import {
  documentToScreen,
  type Camera,
  type Point,
  type Size,
} from "@/engine/coordinates";
import { selectionBounds } from "@/engine/selection";
import {
  CORNER_HANDLES,
  HANDLE_SIZE,
  elementCenter,
  handlePositions,
  toRadians,
} from "@/engine/transformations";

const WORKSPACE_BACKGROUND = "#e5e7eb";
const SELECTION_COLOR = "#2563eb";
const MULTI_SELECTION_COLOR = "#93c5fd";
const HANDLE_FILL = "#ffffff";

export interface RenderScene {
  document: DesignDocument;
  selectedIds: readonly string[];
  camera: Camera;
  /** Canvas size in CSS pixels. */
  size: Size;
  devicePixelRatio: number;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
): void {
  const { document: doc, camera, size, devicePixelRatio } = scene;

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = WORKSPACE_BACKGROUND;
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.save();
  ctx.translate(camera.panX, camera.panY);
  ctx.scale(camera.zoom, camera.zoom);

  drawArtboard(ctx, doc);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, doc.width, doc.height);
  ctx.clip();
  for (const element of doc.elements) {
    drawElement(ctx, element);
  }
  ctx.restore();
  ctx.restore();

  drawSelection(ctx, scene);
}

function drawArtboard(
  ctx: CanvasRenderingContext2D,
  doc: DesignDocument,
): void {
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = doc.background;
  ctx.fillRect(0, 0, doc.width, doc.height);
  ctx.restore();
}

/** Applies the element transform so drawing can happen at the local origin. */
function withElementTransform(
  ctx: CanvasRenderingContext2D,
  element: DesignElement,
  draw: () => void,
): void {
  const center = elementCenter(element);
  ctx.save();
  ctx.globalAlpha = element.opacity;
  ctx.translate(center.x, center.y);
  ctx.rotate(toRadians(element.rotation));
  ctx.translate(-element.width / 2, -element.height / 2);
  draw();
  ctx.restore();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  element: DesignElement,
): void {
  withElementTransform(ctx, element, () => {
    switch (element.type) {
      case "rectangle": {
        ctx.fillStyle = element.fill;
        ctx.fillRect(0, 0, element.width, element.height);
        break;
      }
      case "text": {
        ctx.fillStyle = element.color;
        ctx.font = `${element.fontSize}px ${element.fontFamily}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = element.align;
        const x =
          element.align === "center"
            ? element.width / 2
            : element.align === "right"
              ? element.width
              : 0;
        ctx.fillText(element.text, x, element.height / 2, element.width);
        break;
      }
    }
  });
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
): void {
  const selected = scene.document.elements.filter((element) =>
    scene.selectedIds.includes(element.id),
  );
  if (selected.length === 0) return;

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;

  for (const element of selected) {
    drawElementOutline(ctx, element, scene.camera);
  }

  if (selected.length === 1) {
    drawTransformHandles(ctx, selected[0], scene.camera);
  } else {
    drawGroupBounds(ctx, selected, scene.camera);
  }

  ctx.restore();
}

function outlineCorners(element: DesignElement, camera: Camera): Point[] {
  const positions = handlePositions(element, camera.zoom);
  return CORNER_HANDLES.map((id) => documentToScreen(positions[id], camera));
}

function drawElementOutline(
  ctx: CanvasRenderingContext2D,
  element: DesignElement,
  camera: Camera,
): void {
  const corners = outlineCorners(element, camera);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i += 1) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawTransformHandles(
  ctx: CanvasRenderingContext2D,
  element: DesignElement,
  camera: Camera,
): void {
  const corners = outlineCorners(element, camera);
  const rotate = documentToScreen(
    handlePositions(element, camera.zoom).rotate,
    camera,
  );
  const topEdgeMid = {
    x: (corners[0].x + corners[1].x) / 2,
    y: (corners[0].y + corners[1].y) / 2,
  };

  ctx.beginPath();
  ctx.moveTo(topEdgeMid.x, topEdgeMid.y);
  ctx.lineTo(rotate.x, rotate.y);
  ctx.stroke();

  for (const corner of corners) {
    drawHandleBox(ctx, corner);
  }

  ctx.fillStyle = HANDLE_FILL;
  ctx.beginPath();
  ctx.arc(rotate.x, rotate.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Dashed axis-aligned box around a multi-element selection. */
function drawGroupBounds(
  ctx: CanvasRenderingContext2D,
  elements: readonly DesignElement[],
  camera: Camera,
): void {
  const bounds = selectionBounds(elements);
  if (!bounds) return;

  const topLeft = documentToScreen(bounds, camera);
  ctx.save();
  ctx.strokeStyle = MULTI_SELECTION_COLOR;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(
    topLeft.x,
    topLeft.y,
    bounds.width * camera.zoom,
    bounds.height * camera.zoom,
  );
  ctx.restore();
}

function drawHandleBox(ctx: CanvasRenderingContext2D, point: Point): void {
  const half = HANDLE_SIZE / 2;
  ctx.fillStyle = HANDLE_FILL;
  ctx.fillRect(point.x - half, point.y - half, HANDLE_SIZE, HANDLE_SIZE);
  ctx.strokeRect(point.x - half, point.y - half, HANDLE_SIZE, HANDLE_SIZE);
}
