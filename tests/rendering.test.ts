import { describe, expect, it } from "vitest";

import {
  layoutText,
  lineOffsetX,
  measureWithTracking,
  toCssFont,
  wrapText,
  type TextMeasurer,
} from "@/engine/typography/layout";
import { DEFAULT_TEXT_STYLE, parseHexColor, toCssColor, borderDashPattern } from "@/models/styles";
import {
  distanceToSegment,
  hitTestShape,
  pointInEllipse,
  pointInPolygon,
  regularPolygon,
  shapeVertices,
  starPolygon,
} from "@/engine/geometry/shapes";
import { defaultGeometry } from "@/models/elements";

/** Deterministic measurer: every glyph is half the font size wide. */
const measurer: TextMeasurer = {
  measure: (text, style) => text.length * style.fontSize * 0.5,
};

const style = { ...DEFAULT_TEXT_STYLE, fontSize: 10, lineHeight: 1.5 };

describe("text layout", () => {
  it("measures with letter spacing between characters only", () => {
    expect(measureWithTracking(measurer, "abc", style)).toBe(15);
    expect(
      measureWithTracking(measurer, "abc", { ...style, letterSpacing: 2 }),
    ).toBe(19);
    expect(measureWithTracking(measurer, "", style)).toBe(0);
  });

  it("wraps greedily at word boundaries", () => {
    // Each character is 5 wide, so 40px fits 8 characters.
    expect(wrapText(measurer, "aaa bbb ccc", style, 40)).toEqual([
      "aaa bbb",
      "ccc",
    ]);
  });

  it("honours explicit newlines", () => {
    expect(wrapText(measurer, "one\ntwo", style, 1000)).toEqual(["one", "two"]);
  });

  it("breaks a word that cannot fit the box", () => {
    const lines = wrapText(measurer, "aaaaaaaaaa", style, 20);
    expect(lines.every((line) => line.length <= 4)).toBe(true);
    expect(lines.join("")).toBe("aaaaaaaaaa");
  });

  it("positions lines by line height", () => {
    const layout = layoutText(measurer, "aaa bbb ccc", style, 40);
    expect(layout.lineHeight).toBe(15);
    expect(layout.lines.map((line) => line.y)).toEqual([0, 15]);
    expect(layout.height).toBe(30);
  });

  it("scales the line box with font size and line height", () => {
    const big = layoutText(
      measurer,
      "a",
      { ...style, fontSize: 40, lineHeight: 2 },
      1000,
    );
    expect(big.lineHeight).toBe(80);
  });

  it("justifies every line but the last", () => {
    const layout = layoutText(
      measurer,
      "aa bb cc dd",
      { ...style, align: "justify" },
      30,
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0].wordSpacing).toBeGreaterThan(0);
    expect(layout.lines[1].wordSpacing).toBe(0);
  });

  it("offsets lines for each alignment", () => {
    expect(lineOffsetX("left", 40, 100)).toBe(0);
    expect(lineOffsetX("center", 40, 100)).toBe(30);
    expect(lineOffsetX("right", 40, 100)).toBe(60);
    expect(lineOffsetX("justify", 40, 100)).toBe(0);
  });

  it("builds a CSS font shorthand", () => {
    expect(toCssFont({ ...style, fontWeight: 700, italic: true })).toBe(
      `italic 700 10px ${style.fontFamily}`,
    );
  });
});

describe("colour utilities", () => {
  it("parses shorthand and full hex", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("#4f46e5")).toEqual({ r: 79, g: 70, b: 229 });
  });

  it("falls back to black for malformed input", () => {
    expect(parseHexColor("nonsense")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("applies opacity", () => {
    expect(toCssColor("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
    expect(toCssColor("#ffffff", 4)).toBe("rgba(255, 255, 255, 1)");
  });

  it("derives dash patterns from the border style", () => {
    const border = { color: "#000", width: 2, style: "solid" as const, opacity: 1 };
    expect(borderDashPattern(border)).toEqual([]);
    expect(borderDashPattern({ ...border, style: "dashed" })).toEqual([6, 4]);
    expect(borderDashPattern({ ...border, style: "dotted" })).toEqual([0, 4]);
  });
});

describe("shape geometry", () => {
  it("builds a rectangle from its corners", () => {
    expect(shapeVertices({ kind: "rectangle", cornerRadius: 0 }, 100, 50)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ]);
  });

  it("inscribes a regular polygon with the first vertex at the top", () => {
    const vertices = regularPolygon(4, 100, 100);
    expect(vertices).toHaveLength(4);
    expect(vertices[0].x).toBeCloseTo(50, 6);
    expect(vertices[0].y).toBeCloseTo(0, 6);
  });

  it("alternates star radii", () => {
    const vertices = starPolygon(5, 0.5, 100, 100);
    expect(vertices).toHaveLength(10);
    const outer = Math.hypot(vertices[0].x - 50, vertices[0].y - 50);
    const inner = Math.hypot(vertices[1].x - 50, vertices[1].y - 50);
    expect(inner / outer).toBeCloseTo(0.5, 6);
  });

  it("returns no vertices for the shapes that are not polygons", () => {
    expect(shapeVertices({ kind: "ellipse" }, 10, 10)).toBeNull();
    expect(shapeVertices(defaultGeometry("line"), 10, 10)).toBeNull();
  });

  it("hit-tests a triangle by its outline, not its box", () => {
    const geometry = defaultGeometry("triangle");
    // The top-left corner of the box is outside the triangle.
    expect(hitTestShape(geometry, 100, 100, { x: 5, y: 5 }, 0)).toBe(false);
    expect(hitTestShape(geometry, 100, 100, { x: 50, y: 60 }, 0)).toBe(true);
  });

  it("hit-tests an ellipse by its curve", () => {
    expect(pointInEllipse({ x: 50, y: 50 }, 100, 100)).toBe(true);
    expect(pointInEllipse({ x: 2, y: 2 }, 100, 100)).toBe(false);
  });

  it("hit-tests lines by distance to the segment", () => {
    const geometry = defaultGeometry("line");
    expect(distanceToSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(10);
    expect(hitTestShape(geometry, 100, 20, { x: 50, y: 12 }, 4)).toBe(true);
    expect(hitTestShape(geometry, 100, 20, { x: 50, y: 40 }, 4)).toBe(false);
  });

  it("uses the winding rule for concave shapes", () => {
    const star = starPolygon(5, 0.3, 100, 100);
    expect(pointInPolygon(star, { x: 50, y: 50 })).toBe(true);
    expect(pointInPolygon(star, { x: 2, y: 2 })).toBe(false);
  });
});
