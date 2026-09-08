import type {
  TextAlign,
  TextStyle,
} from "@pixel-studio/types";
/**
 * Text layout: wrapping, line metrics and per-line positioning.
 *
 * Layout is separated from drawing and takes an abstract `TextMeasurer`, so it
 * can be unit tested without a canvas and later reused by an export renderer.
 */


export interface TextMeasurer {
  /** Advance width of `text` when drawn with `style`, excluding tracking. */
  measure(text: string, style: TextStyle): number;
}

export interface LaidOutLine {
  text: string;
  /** Width including letter spacing. */
  width: number;
  /** Baseline-independent top of the line box, relative to the text box. */
  y: number;
  /** Extra space added between words to justify this line. */
  wordSpacing: number;
}

export interface TextLayout {
  lines: LaidOutLine[];
  lineHeight: number;
  /** Total height of all lines. */
  height: number;
}

/** Width of a string including letter spacing between its characters. */
export function measureWithTracking(
  measurer: TextMeasurer,
  text: string,
  style: TextStyle,
): number {
  if (text.length === 0) return 0;
  return (
    measurer.measure(text, style) + style.letterSpacing * (text.length - 1)
  );
}

/**
 * Greedy word wrapping into `maxWidth`. Explicit newlines always break, and a
 * single word longer than the box is broken between characters so text can
 * never escape its box.
 */
export function wrapText(
  measurer: TextMeasurer,
  text: string,
  style: TextStyle,
  maxWidth: number,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let current = "";

    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (
        current.length > 0 &&
        measureWithTracking(measurer, candidate, style) > maxWidth
      ) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }

      while (measureWithTracking(measurer, current, style) > maxWidth) {
        const broken = breakLongWord(measurer, current, style, maxWidth);
        if (broken === null) break;
        lines.push(broken.head);
        current = broken.tail;
      }
    }

    lines.push(current);
  }

  return lines;
}

function breakLongWord(
  measurer: TextMeasurer,
  word: string,
  style: TextStyle,
  maxWidth: number,
): { head: string; tail: string } | null {
  if (word.length <= 1) return null;
  let fit = 1;
  while (
    fit < word.length &&
    measureWithTracking(measurer, word.slice(0, fit + 1), style) <= maxWidth
  ) {
    fit += 1;
  }
  if (fit >= word.length) return null;
  return { head: word.slice(0, fit), tail: word.slice(fit) };
}

/** Horizontal offset of a line inside the box for the given alignment. */
export function lineOffsetX(
  align: TextAlign,
  lineWidth: number,
  boxWidth: number,
): number {
  switch (align) {
    case "left":
    case "justify":
      return 0;
    case "center":
      return (boxWidth - lineWidth) / 2;
    case "right":
      return boxWidth - lineWidth;
  }
}

/** Extra space per gap needed to justify a line, or 0 when it should not be. */
function justifyWordSpacing(
  line: string,
  lineWidth: number,
  boxWidth: number,
  isLastLine: boolean,
): number {
  if (isLastLine) return 0;
  const gaps = line.split(" ").length - 1;
  if (gaps <= 0) return 0;
  return Math.max(0, (boxWidth - lineWidth) / gaps);
}

/** Wraps `text` and positions every line inside a box of `width`. */
export function layoutText(
  measurer: TextMeasurer,
  text: string,
  style: TextStyle,
  width: number,
): TextLayout {
  const lineHeight = style.fontSize * style.lineHeight;
  const wrapped = wrapText(measurer, text, style, Math.max(1, width));

  const lines = wrapped.map((line, index) => {
    const lineWidth = measureWithTracking(measurer, line, style);
    const isLastLine = index === wrapped.length - 1;
    return {
      text: line,
      width: lineWidth,
      y: index * lineHeight,
      wordSpacing:
        style.align === "justify"
          ? justifyWordSpacing(line, lineWidth, width, isLastLine)
          : 0,
    };
  });

  return { lines, lineHeight, height: lines.length * lineHeight };
}

/** CSS font shorthand for a text style. */
export function toCssFont(style: TextStyle): string {
  const italic = style.italic ? "italic " : "";
  return `${italic}${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
}
