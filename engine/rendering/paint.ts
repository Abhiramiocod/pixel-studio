/**
 * Paint helpers: fills, borders and shadows.
 *
 * Every element type routes its painting through these functions, so gradient
 * maths and shadow handling exist exactly once.
 */

import {
  borderDashPattern,
  toCssColor,
  type Border,
  type Fill,
  type Shadow,
} from "@/models/styles";

export interface PaintBox {
  width: number;
  height: number;
}

/**
 * Builds the canvas paint for a fill, in element-local coordinates
 * (0,0)-(width,height).
 */
export function createFillStyle(
  ctx: CanvasRenderingContext2D,
  fill: Fill,
  box: PaintBox,
): string | CanvasGradient {
  switch (fill.type) {
    case "solid":
      return toCssColor(fill.color, fill.opacity);

    case "linear-gradient": {
      const radians = (fill.angle * Math.PI) / 180;
      // Project the gradient axis across the box so it always spans the shape.
      const halfW = box.width / 2;
      const halfH = box.height / 2;
      const dx = Math.cos(radians);
      const dy = Math.sin(radians);
      const extent = Math.abs(halfW * dx) + Math.abs(halfH * dy);
      const gradient = ctx.createLinearGradient(
        halfW - dx * extent,
        halfH - dy * extent,
        halfW + dx * extent,
        halfH + dy * extent,
      );
      addStops(gradient, fill.stops);
      return gradient;
    }

    case "radial-gradient": {
      const radius =
        Math.max(box.width, box.height) * Math.max(0.01, fill.radius);
      const gradient = ctx.createRadialGradient(
        fill.cx * box.width,
        fill.cy * box.height,
        0,
        fill.cx * box.width,
        fill.cy * box.height,
        radius,
      );
      addStops(gradient, fill.stops);
      return gradient;
    }
  }
}

function addStops(
  gradient: CanvasGradient,
  stops: readonly { offset: number; color: string; opacity: number }[],
): void {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  for (const stop of sorted) {
    gradient.addColorStop(
      Math.min(1, Math.max(0, stop.offset)),
      toCssColor(stop.color, stop.opacity),
    );
  }
}

/** Applies shadow settings for the next draw call. */
export function applyShadow(
  ctx: CanvasRenderingContext2D,
  shadow: Shadow | null,
): void {
  if (!shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }
  ctx.shadowColor = toCssColor(shadow.color, shadow.opacity);
  ctx.shadowBlur = shadow.blur;
  ctx.shadowOffsetX = shadow.x;
  ctx.shadowOffsetY = shadow.y;
}

export function clearShadow(ctx: CanvasRenderingContext2D): void {
  applyShadow(ctx, null);
}

/**
 * Fills a path, drawing the shadow first so the spread can be emulated by a
 * scaled pre-pass without bleeding into the visible fill.
 */
export function fillPath(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  fill: Fill,
  box: PaintBox,
  shadow: Shadow | null,
): void {
  if (shadow) {
    ctx.save();
    applyShadow(ctx, shadow);
    if (shadow.spread !== 0) {
      // Approximate spread by scaling the shape about its centre.
      const scaleX = (box.width + shadow.spread * 2) / Math.max(1, box.width);
      const scaleY = (box.height + shadow.spread * 2) / Math.max(1, box.height);
      ctx.translate(box.width / 2, box.height / 2);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-box.width / 2, -box.height / 2);
    }
    // Painting the real fill (not a black stand-in) keeps translucent shapes
    // from picking up a dark backing.
    ctx.fillStyle = createFillStyle(ctx, fill, box);
    ctx.fill(path);
    ctx.restore();
  }

  ctx.save();
  clearShadow(ctx);
  ctx.fillStyle = createFillStyle(ctx, fill, box);
  ctx.fill(path);
  ctx.restore();
}

export function strokePath(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  border: Border | null,
): void {
  if (!border || border.width <= 0) return;
  ctx.save();
  clearShadow(ctx);
  ctx.strokeStyle = toCssColor(border.color, border.opacity);
  ctx.lineWidth = border.width;
  ctx.lineCap = border.style === "dotted" ? "round" : "butt";
  ctx.lineJoin = "round";
  ctx.setLineDash(borderDashPattern(border));
  ctx.stroke(path);
  ctx.restore();
}
