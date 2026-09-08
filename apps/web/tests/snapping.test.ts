import { describe, expect, it } from "vitest";

import { calculateSnap, snapThresholdFor } from "@/engine/snapping/snapping";
import type { Bounds } from "@/engine/geometry/bounds";

const canvas: Bounds = { x: 0, y: 0, width: 1080, height: 1080 };
const threshold = 8;

describe("snapping to the canvas", () => {
  it("snaps the left edge", () => {
    const moving = { x: 5, y: 400, width: 100, height: 100 };
    const snap = calculateSnap(moving, [], canvas, threshold);
    expect(snap.dx).toBe(-5);
    expect(snap.guides.some((guide) => guide.axis === "x" && guide.position === 0)).toBe(true);
  });

  it("snaps the right edge", () => {
    const moving = { x: 976, y: 400, width: 100, height: 100 };
    expect(calculateSnap(moving, [], canvas, threshold).dx).toBe(4);
  });

  it("snaps the top and bottom edges", () => {
    expect(
      calculateSnap({ x: 400, y: -3, width: 100, height: 100 }, [], canvas, threshold).dy,
    ).toBe(3);
    expect(
      calculateSnap({ x: 400, y: 984, width: 100, height: 100 }, [], canvas, threshold).dy,
    ).toBe(-4);
  });

  it("snaps to the canvas centre on both axes", () => {
    const moving = { x: 487, y: 486, width: 100, height: 100 };
    const snap = calculateSnap(moving, [], canvas, threshold);
    expect(moving.x + snap.dx + 50).toBe(540);
    expect(moving.y + snap.dy + 50).toBe(540);
    expect(snap.guides).toHaveLength(2);
  });

  it("does nothing beyond the threshold", () => {
    const moving = { x: 300, y: 300, width: 100, height: 100 };
    expect(calculateSnap(moving, [], canvas, threshold)).toMatchObject({
      dx: 0,
      dy: 0,
      guides: [],
    });
  });
});

describe("snapping to other elements", () => {
  const other: Bounds = { x: 300, y: 200, width: 200, height: 100 };

  it("aligns left edges", () => {
    const moving = { x: 304, y: 600, width: 50, height: 50 };
    expect(calculateSnap(moving, [other], canvas, threshold).dx).toBe(-4);
  });

  it("aligns an edge to the other element's centre", () => {
    const moving = { x: 396, y: 600, width: 50, height: 50 };
    const snap = calculateSnap(moving, [other], canvas, threshold);
    expect(moving.x + snap.dx).toBe(400);
  });

  it("aligns vertical centres", () => {
    const moving = { x: 700, y: 222, width: 50, height: 50 };
    const snap = calculateSnap(moving, [other], canvas, threshold);
    expect(moving.y + snap.dy + 25).toBe(250);
  });

  it("prefers the nearest candidate", () => {
    const near: Bounds = { x: 502, y: 600, width: 10, height: 10 };
    const far: Bounds = { x: 495, y: 600, width: 10, height: 10 };
    const moving = { x: 503, y: 800, width: 20, height: 20 };
    const snap = calculateSnap(moving, [near, far], canvas, threshold);
    expect(moving.x + snap.dx).toBe(502);
  });

  it("produces a guide spanning both objects", () => {
    const moving = { x: 302, y: 600, width: 50, height: 50 };
    const snap = calculateSnap(moving, [other], canvas, threshold);
    const guide = snap.guides.find((candidate) => candidate.position === 300);
    expect(guide).toBeDefined();
    expect(guide?.start).toBeLessThanOrEqual(200);
    expect(guide?.end).toBeGreaterThanOrEqual(650);
  });
});

describe("snap threshold", () => {
  it("shrinks in document units as zoom grows", () => {
    expect(snapThresholdFor(1)).toBeGreaterThan(snapThresholdFor(4));
    expect(snapThresholdFor(0.5)).toBe(snapThresholdFor(1) * 2);
  });

  it("is disabled at a zero threshold", () => {
    const moving = { x: 1, y: 1, width: 10, height: 10 };
    expect(calculateSnap(moving, [], canvas, 0).guides).toEqual([]);
  });
});
