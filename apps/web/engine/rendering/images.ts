/**
 * Image drawing: crop window, flips and rounded corners.
 *
 * The element keeps its full source and a crop rectangle, so cropping is always
 * reversible - nothing about the original is discarded.
 */

import type {
  ImageElement,
} from "@pixel-studio/types";
import { getImage } from "@/engine/images/imageCache";
import { roundedRectPath } from "@/engine/rendering/shapes";
import { applyShadow, clearShadow, strokePath } from "@/engine/rendering/paint";

const PLACEHOLDER_FILL = "rgba(148, 163, 184, 0.25)";

/** Draws an image element at the element-local origin. */
export function renderImage(
  ctx: CanvasRenderingContext2D,
  element: ImageElement,
): void {
  const path = roundedRectPath(
    element.width,
    element.height,
    element.cornerRadius,
  );
  const image = getImage(element.src);

  if (element.shadow) {
    ctx.save();
    applyShadow(ctx, element.shadow);
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fill(path);
    ctx.restore();
  }

  ctx.save();
  clearShadow(ctx);
  ctx.clip(path);

  if (!image) {
    // Placeholder while the source decodes, so layout stays stable.
    ctx.fillStyle = PLACEHOLDER_FILL;
    ctx.fillRect(0, 0, element.width, element.height);
  } else {
    ctx.translate(element.width / 2, element.height / 2);
    ctx.scale(element.flipX ? -1 : 1, element.flipY ? -1 : 1);
    ctx.drawImage(
      image,
      element.crop.x,
      element.crop.y,
      Math.max(1, element.crop.width),
      Math.max(1, element.crop.height),
      -element.width / 2,
      -element.height / 2,
      element.width,
      element.height,
    );
  }

  ctx.restore();

  strokePath(ctx, path, element.border);
}
