/**
 * 2D affine transforms.
 *
 * Nested containers, rotation and the camera all compose through the same
 * matrix type, so there is one place where transform maths lives instead of one
 * per feature. Layout matches the canvas API: [a c e / b d f / 0 0 1].
 */

import type { Point } from "@/engine/coordinates";

export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function multiplyAll(matrices: readonly Matrix[]): Matrix {
  return matrices.reduce(multiply, IDENTITY);
}

export function translation(x: number, y: number): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

export function rotation(degrees: number): Matrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

export function scaling(sx: number, sy: number): Matrix {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
}

export function applyToPoint(m: Matrix, point: Point): Point {
  return {
    x: m.a * point.x + m.c * point.y + m.e,
    y: m.b * point.x + m.d * point.y + m.f,
  };
}

export function determinant(m: Matrix): number {
  return m.a * m.d - m.b * m.c;
}

/** Inverse of an affine matrix, or the identity when it is singular. */
export function invert(m: Matrix): Matrix {
  const det = determinant(m);
  if (det === 0) return IDENTITY;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}
