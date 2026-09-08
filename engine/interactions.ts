/**
 * Pointer gestures on the canvas.
 *
 * A gesture is created once on pointer down (`beginGesture`) and asked for the
 * element changes it implies on every pointer move (`updateGesture`). All maths
 * happens in document space, so gestures behave identically at any zoom or pan.
 */

import type { DesignElement, ElementPatch } from "@/models/design";
import type { Point } from "@/engine/coordinates";
import {
  hitTestHandle,
  normalizeAngle,
  pointerAngle,
  resizeElement,
  type HandleId,
} from "@/engine/transformations";

export interface ElementChange {
  id: string;
  patch: ElementPatch;
}

export type Gesture =
  | {
      kind: "move";
      /** Pointer position at gesture start, in document space. */
      origin: Point;
      /** Start positions of every element being moved. */
      starts: ReadonlyArray<{ id: string; x: number; y: number }>;
    }
  | {
      kind: "resize";
      elementId: string;
      handle: Exclude<HandleId, "rotate">;
    }
  | {
      kind: "rotate";
      elementId: string;
      /** Difference between pointer angle and element rotation at start. */
      angleOffset: number;
    };

/**
 * Decides which gesture a press starts. Handles on the sole selected element
 * win over the element body, so a press near a corner resizes rather than moves.
 * Resize and rotate apply to a single element only; moving supports many.
 */
export function beginGesture(
  elements: readonly DesignElement[],
  point: Point,
  zoom: number,
): Gesture | null {
  if (elements.length === 0) return null;

  if (elements.length === 1) {
    const element = elements[0];
    const handle = hitTestHandle(element, point, zoom);

    if (handle === "rotate") {
      return {
        kind: "rotate",
        elementId: element.id,
        angleOffset: pointerAngle(element, point) - element.rotation,
      };
    }
    if (handle !== null) {
      return { kind: "resize", elementId: element.id, handle };
    }
  }

  return {
    kind: "move",
    origin: point,
    starts: elements.map((element) => ({
      id: element.id,
      x: element.x,
      y: element.y,
    })),
  };
}

/** The element changes this gesture implies for the current pointer position. */
export function updateGesture(
  gesture: Gesture,
  elements: readonly DesignElement[],
  point: Point,
): ElementChange[] {
  switch (gesture.kind) {
    case "move": {
      const dx = point.x - gesture.origin.x;
      const dy = point.y - gesture.origin.y;
      return gesture.starts.map((start) => ({
        id: start.id,
        patch: { x: start.x + dx, y: start.y + dy },
      }));
    }
    case "resize": {
      const element = elements.find((item) => item.id === gesture.elementId);
      if (!element) return [];
      return [
        { id: element.id, patch: resizeElement(element, gesture.handle, point) },
      ];
    }
    case "rotate": {
      const element = elements.find((item) => item.id === gesture.elementId);
      if (!element) return [];
      return [
        {
          id: element.id,
          patch: {
            rotation: normalizeAngle(
              pointerAngle(element, point) - gesture.angleOffset,
            ),
          },
        },
      ];
    }
  }
}

const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  rotate: "grab",
};

export function cursorForHandle(handle: HandleId): string {
  return HANDLE_CURSORS[handle];
}
