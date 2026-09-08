/**
 * Visual styles that are part of the persisted design document.
 *
 * Colours are `#rrggbb` hex strings with a separate 0..1 opacity: simple to
 * store, simple to edit, and unambiguous when serialized to JSON.
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
