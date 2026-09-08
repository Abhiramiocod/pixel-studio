/**
 * Shape paths.
 *
 * Paths are built in element-local coordinates from the same vertex data the
 * hit-testing uses, so what is drawn and what is clickable can never diverge.
 */

import type {
  ShapeElement,
} from "@pixel-studio/types";
import { isStrokeShape } from "@/models/elements";
import {
  denormalize,
  shapeVertices,
} from "@/engine/geometry/shapes";
import { fillPath, strokePath } from "@/engine/rendering/paint";

/** Rounded rectangle path, falling back to a plain rect when radius is 0. */
export function roundedRectPath(
  width: number,
  height: number,
  radius: number,
): Path2D {
  const path = new Path2D();
  const limit = Math.min(width, height) / 2;
  const r = Math.min(Math.max(0, radius), limit);
  if (r <= 0) {
    path.rect(0, 0, width, height);
    return path;
  }
  path.moveTo(r, 0);
  path.lineTo(width - r, 0);
  path.arcTo(width, 0, width, r, r);
  path.lineTo(width, height - r);
  path.arcTo(width, height, width - r, height, r);
  path.lineTo(r, height);
  path.arcTo(0, height, 0, height - r, r);
  path.lineTo(0, r);
  path.arcTo(0, 0, r, 0, r);
  path.closePath();
  return path;
}

/** The closed outline of a shape, or null for line/arrow which are stroked. */
export function shapePath(element: ShapeElement): Path2D | null {
  const { geometry, width, height } = element;

  if (geometry.kind === "rectangle") {
    return roundedRectPath(width, height, geometry.cornerRadius);
  }

  if (geometry.kind === "ellipse") {
    const path = new Path2D();
    path.ellipse(
      width / 2,
      height / 2,
      Math.max(0.01, width / 2),
      Math.max(0.01, height / 2),
      0,
      0,
      Math.PI * 2,
    );
    return path;
  }

  const vertices = shapeVertices(geometry, width, height);
  if (!vertices || vertices.length === 0) return null;

  const path = new Path2D();
  path.moveTo(vertices[0].x, vertices[0].y);
  for (const vertex of vertices.slice(1)) path.lineTo(vertex.x, vertex.y);
  path.closePath();
  return path;
}

/** Open path for line and arrow shapes, including the arrow head. */
export function strokeShapePath(element: ShapeElement): Path2D | null {
  const { geometry, width, height } = element;
  if (geometry.kind !== "line" && geometry.kind !== "arrow") return null;

  const start = denormalize(geometry.start, width, height);
  const end = denormalize(geometry.end, width, height);

  const path = new Path2D();
  path.moveTo(start.x, start.y);
  path.lineTo(end.x, end.y);

  if (geometry.kind === "arrow") {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const size = Math.max(1, geometry.headSize);
    const spread = Math.PI / 7;
    path.moveTo(end.x, end.y);
    path.lineTo(
      end.x - Math.cos(angle - spread) * size,
      end.y - Math.sin(angle - spread) * size,
    );
    path.moveTo(end.x, end.y);
    path.lineTo(
      end.x - Math.cos(angle + spread) * size,
      end.y - Math.sin(angle + spread) * size,
    );
  }

  return path;
}

/** Draws a shape at the element-local origin; the caller sets the transform. */
export function renderShape(
  ctx: CanvasRenderingContext2D,
  element: ShapeElement,
): void {
  const box = { width: element.width, height: element.height };

  if (isStrokeShape(element.geometry)) {
    const path = strokeShapePath(element);
    if (!path) return;
    // A stroked shape has no interior: its colour comes from the border, and
    // the fill colour acts as the fallback stroke when no border is set.
    strokePath(
      ctx,
      path,
      element.border ?? {
        color:
          element.fill.type === "solid" ? element.fill.color : "#111827",
        width: 4,
        style: "solid",
        opacity: 1,
      },
    );
    return;
  }

  const path = shapePath(element);
  if (!path) return;
  fillPath(ctx, path, element.fill, box, element.shadow);
  strokePath(ctx, path, element.border);
}
