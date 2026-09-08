/**
 * Canvas rendering.
 *
 * The renderer is a pure function of (document, selection, viewport): it never
 * reads React state and never mutates the model. Everything is drawn in design
 * coordinates; the viewport transform maps that onto the canvas.
 */

import type { DesignDocument, DesignElement } from "@/models/design";
import { designToScreen, type Size, type Viewport } from "@/engine/coordinates";
import {
  CORNER_HANDLES,
  HANDLE_SIZE,
  elementCenter,
  handlePositions,
  toRadians,
} from "@/engine/transformations";

const WORKSPACE_BACKGROUND = "#e5e7eb";
const SELECTION_COLOR = "#2563eb";
const HANDLE_FILL = "#ffffff";

export interface RenderScene {
  document: DesignDocument;
  selectedId: string | null;
  viewport: Viewport;
  /** Canvas size in CSS pixels. */
  size: Size;
  devicePixelRatio: number;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
): void {
  const { document: doc, viewport, size, devicePixelRatio } = scene;

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = WORKSPACE_BACKGROUND;
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.save();
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.zoom, viewport.zoom);

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

  const selected = doc.elements.find(
    (element) => element.id === scene.selectedId,
  );
  if (selected) {
    drawSelection(ctx, selected, viewport);
  }
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

/**
 * Selection chrome is drawn in screen space so outlines and handles keep a
 * constant size regardless of zoom.
 */
function drawSelection(
  ctx: CanvasRenderingContext2D,
  element: DesignElement,
  viewport: Viewport,
): void {
  const positions = handlePositions(element, viewport.zoom);
  const corners = CORNER_HANDLES.filter((id) => id !== "rotate").map((id) =>
    designToScreen(positions[id], viewport),
  );
  const rotate = designToScreen(positions.rotate, viewport);
  const topEdgeMid = {
    x: (corners[0].x + corners[1].x) / 2,
    y: (corners[0].y + corners[1].y) / 2,
  };

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i += 1) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.stroke();

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

  ctx.restore();
}

function drawHandleBox(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
): void {
  const half = HANDLE_SIZE / 2;
  ctx.fillStyle = HANDLE_FILL;
  ctx.fillRect(point.x - half, point.y - half, HANDLE_SIZE, HANDLE_SIZE);
  ctx.strokeRect(point.x - half, point.y - half, HANDLE_SIZE, HANDLE_SIZE);
}
