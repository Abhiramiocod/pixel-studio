/**
 * Reusable visual styles: fills, borders, shadows and typography.
 *
 * Styles are plain serializable data shared by every element type, so paint
 * logic lives in one place instead of being re-implemented per shape. Colours
 * are `#rrggbb` hex strings with a separate 0..1 opacity, which keeps colour
 * inputs simple while still allowing transparency.
 */

export type Color = string;

export interface GradientStop {
  /** 0..1 along the gradient. */
  offset: number;
  color: Color;
  opacity: number;
}

export interface SolidFill {
  type: "solid";
  color: Color;
  opacity: number;
}

export interface LinearGradientFill {
  type: "linear-gradient";
  /** Degrees clockwise; 0 points to the right, 90 points down. */
  angle: number;
  stops: GradientStop[];
}

export interface RadialGradientFill {
  type: "radial-gradient";
  /** Centre in normalised element coordinates (0..1). */
  cx: number;
  cy: number;
  /** Radius as a fraction of the element's larger side. */
  radius: number;
  stops: GradientStop[];
}

export type Fill = SolidFill | LinearGradientFill | RadialGradientFill;

export type BorderStyle = "solid" | "dashed" | "dotted";

export interface Border {
  color: Color;
  width: number;
  style: BorderStyle;
  opacity: number;
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  /** Grows the shadow shape before blurring. */
  spread: number;
  color: Color;
  opacity: number;
}

export type TextAlign = "left" | "center" | "right" | "justify";

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  /** CSS numeric weight, 100..900. */
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  color: Color;
  align: TextAlign;
  /** Multiplier of the font size. */
  lineHeight: number;
  /** Extra space between characters, in document units. */
  letterSpacing: number;
}

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
