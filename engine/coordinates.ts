/**
 * Screen <-> design coordinate conversion.
 *
 * The design document always uses its own coordinate system (1080 x 1080 by
 * default). Everything the user sees is that space pushed through a `Viewport`,
 * so zoom and pan can be introduced later without touching element maths.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  /** Design units per CSS pixel. */
  zoom: number;
  /** Position of the design origin, in CSS pixels inside the canvas element. */
  offsetX: number;
  offsetY: number;
}

export const IDENTITY_VIEWPORT: Viewport = { zoom: 1, offsetX: 0, offsetY: 0 };

/** Centres the design inside `container`, scaled down to fit (never up-scaled). */
export function fitViewport(
  container: Size,
  design: Size,
  padding = 48,
): Viewport {
  const availableWidth = Math.max(1, container.width - padding * 2);
  const availableHeight = Math.max(1, container.height - padding * 2);
  const zoom = Math.min(
    1,
    availableWidth / design.width,
    availableHeight / design.height,
  );

  return {
    zoom,
    offsetX: (container.width - design.width * zoom) / 2,
    offsetY: (container.height - design.height * zoom) / 2,
  };
}

export function screenToDesign(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.offsetX) / viewport.zoom,
    y: (point.y - viewport.offsetY) / viewport.zoom,
  };
}

export function designToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.offsetX,
    y: point.y * viewport.zoom + viewport.offsetY,
  };
}

/** Converts a pointer event position into canvas-relative CSS pixels. */
export function clientToCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** Convenience: pointer event position straight to design coordinates. */
export function clientToDesignPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  viewport: Viewport,
): Point {
  return screenToDesign(clientToCanvasPoint(canvas, clientX, clientY), viewport);
}
