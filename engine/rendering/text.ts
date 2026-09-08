/**
 * Text drawing.
 *
 * Layout (wrapping, line positions, justification) lives in
 * `engine/typography/layout`; this module only puts the laid-out lines on the
 * canvas, including letter spacing and underlines.
 */

import type { TextElement } from "@/models/elements";
import { toCssColor, type TextStyle } from "@/models/styles";
import {
  layoutText,
  lineOffsetX,
  toCssFont,
  type TextLayout,
  type TextMeasurer,
} from "@/engine/typography/layout";
import { applyShadow, clearShadow } from "@/engine/rendering/paint";

/** Measures text with a canvas context, caching the font string it sets. */
export function canvasMeasurer(
  ctx: CanvasRenderingContext2D,
): TextMeasurer {
  return {
    measure(text: string, style: TextStyle): number {
      ctx.font = toCssFont(style);
      return ctx.measureText(text).width;
    },
  };
}

export function layoutTextElement(
  ctx: CanvasRenderingContext2D,
  element: TextElement,
): TextLayout {
  return layoutText(
    canvasMeasurer(ctx),
    element.text,
    element.style,
    element.width,
  );
}

/**
 * Draws one line, advancing manually when letter spacing or justification is in
 * play so tracking works in every browser.
 */
function drawLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  style: TextStyle,
  wordSpacing: number,
): number {
  if (style.letterSpacing === 0 && wordSpacing === 0) {
    ctx.fillText(text, x, baseline);
    return ctx.measureText(text).width;
  }

  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, baseline);
    cursor +=
      ctx.measureText(char).width +
      style.letterSpacing +
      (char === " " ? wordSpacing : 0);
  }
  return cursor - x - style.letterSpacing;
}

/** Draws a text element at the element-local origin. */
export function renderText(
  ctx: CanvasRenderingContext2D,
  element: TextElement,
): void {
  const style = element.style;
  const layout = layoutTextElement(ctx, element);

  ctx.save();
  applyShadow(ctx, element.shadow);
  ctx.font = toCssFont(style);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = toCssColor(style.color, 1);

  for (const line of layout.lines) {
    const justified = line.wordSpacing > 0;
    const width = justified ? element.width : line.width;
    const x = lineOffsetX(style.align, width, element.width);
    // Approximate the ascent so lines sit inside their line box.
    const baseline = line.y + style.fontSize * 0.8;

    const drawn = drawLine(
      ctx,
      line.text,
      x,
      baseline,
      style,
      line.wordSpacing,
    );

    if (style.underline && line.text.length > 0) {
      const thickness = Math.max(1, style.fontSize / 16);
      const underlineY = baseline + style.fontSize * 0.12;
      clearShadow(ctx);
      ctx.fillRect(x, underlineY, drawn, thickness);
    }
  }

  ctx.restore();
}
