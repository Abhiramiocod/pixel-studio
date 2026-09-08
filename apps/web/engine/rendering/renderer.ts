/**
 * Scene rendering.
 *
 * `renderScene` is a pure function of (document, selection, camera, guides): it
 * never reads React state and never mutates the model. The element tree is
 * drawn under the camera transform in document coordinates; selection chrome
 * and snap guides are drawn afterwards in screen space so they keep a constant
 * size at any zoom.
 */

import type {
  DesignDocument,
  DesignElement,
  FrameElement,
} from "@pixel-studio/types";
import { isContainer } from "@/models/elements";
import {
  documentToScreen,
  type Camera,
  type Point,
  type Size,
} from "@/engine/coordinates";
import { localMatrix } from "@/engine/transformations";
import type { Matrix } from "@/engine/geometry/matrix";
import type { SnapGuide } from "@/engine/snapping/snapping";
import { selectionBounds } from "@/engine/selection";
import {
  CORNER_HANDLES,
  HANDLE_SIZE,
  handlePositions,
} from "@/engine/transformations";
import { createFillStyle, fillPath, strokePath } from "@/engine/rendering/paint";
import { renderShape, roundedRectPath } from "@/engine/rendering/shapes";
import { renderText } from "@/engine/rendering/text";
import { renderImage } from "@/engine/rendering/images";

const WORKSPACE_BACKGROUND = "#e5e7eb";
const SELECTION_COLOR = "#2563eb";
const GROUP_SELECTION_COLOR = "#93c5fd";
const GUIDE_COLOR = "#ec4899";
const HANDLE_FILL = "#ffffff";

export interface RenderScene {
  document: DesignDocument;
  selectedIds: readonly string[];
  camera: Camera;
  /** Canvas size in CSS pixels. */
  size: Size;
  devicePixelRatio: number;
  /** Transient alignment guides shown during a drag. */
  guides: readonly SnapGuide[];
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
  renderElements(ctx, doc.elements, 1);
  ctx.restore();

  ctx.restore();

  drawGuides(ctx, scene);
  drawSelection(ctx, scene);
}

function drawArtboard(
  ctx: CanvasRenderingContext2D,
  doc: DesignDocument,
): void {
  const box = { width: doc.width, height: doc.height };
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = createFillStyle(ctx, doc.background, box);
  ctx.fillRect(0, 0, doc.width, doc.height);
  ctx.restore();
}

function setMatrix(ctx: CanvasRenderingContext2D, matrix: Matrix): void {
  ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
}

/** Draws a list of siblings; `alpha` carries container opacity down the tree. */
export function renderElements(
  ctx: CanvasRenderingContext2D,
  elements: readonly DesignElement[],
  alpha: number,
): void {
  for (const element of elements) {
    if (!element.visible || element.opacity === 0) continue;
    renderElement(ctx, element, alpha);
  }
}

/** Draws one element and its subtree in its parent's content space. */
export function renderElement(
  ctx: CanvasRenderingContext2D,
  element: DesignElement,
  alpha: number,
): void {
  const effectiveAlpha = alpha * element.opacity;

  ctx.save();
  setMatrix(ctx, localMatrix(element));
  ctx.globalAlpha = effectiveAlpha;

  switch (element.type) {
    case "shape":
      renderShape(ctx, element);
      break;
    case "text":
      renderText(ctx, element);
      break;
    case "image":
      renderImage(ctx, element);
      break;
    case "frame":
      renderFrame(ctx, element, effectiveAlpha);
      break;
    case "group":
      // A group has no surface of its own; only its contents draw.
      renderElements(ctx, element.children, effectiveAlpha);
      break;
  }

  ctx.restore();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  element: FrameElement,
  alpha: number,
): void {
  const path = roundedRectPath(
    element.width,
    element.height,
    element.cornerRadius,
  );
  fillPath(
    ctx,
    path,
    element.fill,
    { width: element.width, height: element.height },
    element.shadow,
  );

  ctx.save();
  if (element.clipContent) ctx.clip(path);
  renderElements(ctx, element.children, alpha);
  ctx.restore();

  strokePath(ctx, path, element.border);
}

/* ------------------------------------------------------------------ *
 * Overlays
 * ------------------------------------------------------------------ */

function drawSelection(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
): void {
  const selected = collectSelected(scene.document.elements, scene.selectedIds);
  if (selected.length === 0) return;

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);

  for (const element of selected) {
    drawOutline(ctx, scene, element);
  }

  if (selected.length === 1) {
    drawTransformHandles(ctx, scene, selected[0]);
  } else {
    drawGroupBounds(ctx, scene, selected);
  }

  ctx.restore();
}

function collectSelected(
  elements: readonly DesignElement[],
  selectedIds: readonly string[],
): DesignElement[] {
  const found: DesignElement[] = [];
  const visit = (list: readonly DesignElement[]) => {
    for (const element of list) {
      if (selectedIds.includes(element.id)) found.push(element);
      if (isContainer(element)) visit(element.children);
    }
  };
  visit(elements);
  return found;
}

/** Screen-space corners of an element, following every ancestor transform. */
function screenCorners(
  scene: RenderScene,
  element: DesignElement,
): Point[] {
  const positions = handlePositions(scene.document, element, scene.camera.zoom);
  return CORNER_HANDLES.map((id) =>
    documentToScreen(positions[id], scene.camera),
  );
}

function drawOutline(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
  element: DesignElement,
): void {
  const corners = screenCorners(scene, element);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y);
  ctx.closePath();
  ctx.stroke();
}

function drawTransformHandles(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
  element: DesignElement,
): void {
  const corners = screenCorners(scene, element);
  const rotate = documentToScreen(
    handlePositions(scene.document, element, scene.camera.zoom).rotate,
    scene.camera,
  );
  const topEdgeMid = {
    x: (corners[0].x + corners[1].x) / 2,
    y: (corners[0].y + corners[1].y) / 2,
  };

  ctx.beginPath();
  ctx.moveTo(topEdgeMid.x, topEdgeMid.y);
  ctx.lineTo(rotate.x, rotate.y);
  ctx.stroke();

  for (const corner of corners) drawHandleBox(ctx, corner);

  ctx.fillStyle = HANDLE_FILL;
  ctx.beginPath();
  ctx.arc(rotate.x, rotate.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawGroupBounds(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
  elements: readonly DesignElement[],
): void {
  const bounds = selectionBounds(scene.document, elements);
  if (!bounds) return;

  const topLeft = documentToScreen(bounds, scene.camera);
  ctx.save();
  ctx.strokeStyle = GROUP_SELECTION_COLOR;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(
    topLeft.x,
    topLeft.y,
    bounds.width * scene.camera.zoom,
    bounds.height * scene.camera.zoom,
  );
  ctx.restore();
}

function drawHandleBox(ctx: CanvasRenderingContext2D, point: Point): void {
  const half = HANDLE_SIZE / 2;
  ctx.fillStyle = HANDLE_FILL;
  ctx.fillRect(point.x - half, point.y - half, HANDLE_SIZE, HANDLE_SIZE);
  ctx.strokeRect(point.x - half, point.y - half, HANDLE_SIZE, HANDLE_SIZE);
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
): void {
  if (scene.guides.length === 0) return;

  ctx.save();
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (const guide of scene.guides) {
    const from =
      guide.axis === "x"
        ? documentToScreen({ x: guide.position, y: guide.start }, scene.camera)
        : documentToScreen({ x: guide.start, y: guide.position }, scene.camera);
    const to =
      guide.axis === "x"
        ? documentToScreen({ x: guide.position, y: guide.end }, scene.camera)
        : documentToScreen({ x: guide.end, y: guide.position }, scene.camera);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  ctx.restore();
}
