/**
 * Style defaults, factories and colour utilities.
 *
 * The style *shapes* live in `@pixel-studio/types` because they are part of a
 * saved design; this module holds the editor-side behaviour that creates and
 * interprets them.
 */

import type {
  Border,
  Color,
  Fill,
  LinearGradientFill,
  RadialGradientFill,
  Shadow,
  SolidFill,
  TextStyle,
} from "@pixel-studio/types";

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 64,
  fontWeight: 400,
  italic: false,
  underline: false,
  color: "#111827",
  align: "left",
  lineHeight: 1.25,
  letterSpacing: 0,
};

/** Font stacks offered in the properties panel; all resolve locally. */
export const FONT_FAMILIES: readonly string[] = [
  "Inter, system-ui, sans-serif",
  "Georgia, serif",
  "Times New Roman, serif",
  "Courier New, monospace",
  "Verdana, sans-serif",
  "Trebuchet MS, sans-serif",
];

export const FONT_WEIGHTS: readonly number[] = [300, 400, 500, 600, 700, 800];

export function createSolidFill(color: Color, opacity = 1): SolidFill {
  return { type: "solid", color, opacity };
}

export function createLinearGradient(
  from: Color,
  to: Color,
  angle = 90,
): LinearGradientFill {
  return {
    type: "linear-gradient",
    angle,
    stops: [
      { offset: 0, color: from, opacity: 1 },
      { offset: 1, color: to, opacity: 1 },
    ],
  };
}

export function createRadialGradient(
  from: Color,
  to: Color,
): RadialGradientFill {
  return {
    type: "radial-gradient",
    cx: 0.5,
    cy: 0.5,
    radius: 0.7,
    stops: [
      { offset: 0, color: from, opacity: 1 },
      { offset: 1, color: to, opacity: 1 },
    ],
  };
}

export const DEFAULT_BORDER: Border = {
  color: "#111827",
  width: 2,
  style: "solid",
  opacity: 1,
};

export const DEFAULT_SHADOW: Shadow = {
  x: 0,
  y: 8,
  blur: 16,
  spread: 0,
  color: "#0f172a",
  opacity: 0.25,
};

/** Parses `#rgb` / `#rrggbb` into channel values; falls back to black. */
export function parseHexColor(color: Color): {
  r: number;
  g: number;
  b: number;
} {
  const hex = color.trim().replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Canvas-ready colour string combining a hex colour with an opacity. */
export function toCssColor(color: Color, opacity = 1): string {
  const { r, g, b } = parseHexColor(color);
  const alpha = Math.min(1, Math.max(0, opacity));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Dash pattern for a border style, in document units. */
export function borderDashPattern(border: Border): number[] {
  switch (border.style) {
    case "solid":
      return [];
    case "dashed":
      return [border.width * 3, border.width * 2];
    case "dotted":
      return [0, border.width * 2];
  }
}

/** A representative colour for a fill, used for swatches and previews. */
export function primaryFillColor(fill: Fill): Color {
  return fill.type === "solid" ? fill.color : (fill.stops[0]?.color ?? "#000000");
}
