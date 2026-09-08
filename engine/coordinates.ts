/**
 * Coordinate systems.
 *
 *   Document space   the stored design coordinates (1080 x 1080). Never changes.
 *        |           camera transform: scale by zoom, then translate by pan
 *   Screen space     CSS pixels inside the canvas element.
 *
 * Zoom and pan only ever affect the camera, so element coordinates in the
 * document are untouched by viewing operations.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The camera maps document space onto the viewport. */
export interface Camera {
  /** Screen pixels per document unit. */
  zoom: number;
  /** Screen position of the document origin, in CSS pixels. */
  panX: number;
  panY: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

/** Zoom steps offered in the UI. */
export const ZOOM_PRESETS: readonly number[] = [
  0.25, 0.5, 0.75, 1, 1.5, 2, 4,
];

export const DEFAULT_CAMERA: Camera = { zoom: 1, panX: 0, panY: 0 };

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function documentToScreen(point: Point, camera: Camera): Point {
  return {
    x: point.x * camera.zoom + camera.panX,
    y: point.y * camera.zoom + camera.panY,
  };
}

export function screenToDocument(point: Point, camera: Camera): Point {
  return {
    x: (point.x - camera.panX) / camera.zoom,
    y: (point.y - camera.panY) / camera.zoom,
  };
}

/** Camera that centres the document in the viewport, scaled down to fit. */
export function createFitCamera(
  viewport: Size,
  design: Size,
  padding = 64,
): Camera {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = clampZoom(
    Math.min(1, availableWidth / design.width, availableHeight / design.height),
  );
  return centerCamera(zoom, viewport, design);
}

/** Keeps the given zoom but re-centres the document in the viewport. */
export function centerCamera(
  zoom: number,
  viewport: Size,
  design: Size,
): Camera {
  return {
    zoom,
    panX: (viewport.width - design.width * zoom) / 2,
    panY: (viewport.height - design.height * zoom) / 2,
  };
}

/**
 * Changes zoom while keeping `anchor` (a screen point) over the same document
 * point - the behaviour expected from wheel zoom and zoom buttons.
 */
export function zoomAt(camera: Camera, nextZoom: number, anchor: Point): Camera {
  const zoom = clampZoom(nextZoom);
  const ratio = zoom / camera.zoom;
  return {
    zoom,
    panX: anchor.x - (anchor.x - camera.panX) * ratio,
    panY: anchor.y - (anchor.y - camera.panY) * ratio,
  };
}

/** Zooms about the centre of the viewport. */
export function zoomAtViewportCenter(
  camera: Camera,
  nextZoom: number,
  viewport: Size,
): Camera {
  return zoomAt(camera, nextZoom, {
    x: viewport.width / 2,
    y: viewport.height / 2,
  });
}

/** The next preset above (direction 1) or below (direction -1) `zoom`. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  if (direction === 1) {
    return (
      ZOOM_PRESETS.find((preset) => preset > zoom + 0.001) ??
      clampZoom(zoom * 2)
    );
  }
  return (
    [...ZOOM_PRESETS].reverse().find((preset) => preset < zoom - 0.001) ??
    clampZoom(zoom / 2)
  );
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, panX: camera.panX + dx, panY: camera.panY + dy };
}

/** Pointer position -> screen space (CSS pixels relative to the canvas). */
export function clientToScreenPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** Pointer position -> document space. */
export function clientToDocumentPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  camera: Camera,
): Point {
  return screenToDocument(
    clientToScreenPoint(canvas, clientX, clientY),
    camera,
  );
}
