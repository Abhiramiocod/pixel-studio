/**
 * Pointer gestures on the canvas.
 *
 * A gesture is started once (`beginGesture`) and then asked for a patch on every
 * pointer move (`updateGesture`). Keeping this outside the React components means
 * drag/resize/rotate behaviour is testable and reusable.
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

export type Gesture =
  | {
      kind: "move";
      elementId: string;
      /** Pointer position at gesture start, in design space. */
      origin: Point;
      startX: number;
      startY: number;
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
 * Decides which gesture a press on `element` starts. Handles win over the body,
 * so a press near a corner resizes rather than moves.
 */
export function beginGesture(
  element: DesignElement,
  point: Point,
  zoom: number,
): Gesture {
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

  return {
    kind: "move",
    elementId: element.id,
    origin: point,
    startX: element.x,
    startY: element.y,
  };
}

/** The patch this gesture implies for the current pointer position. */
export function updateGesture(
  gesture: Gesture,
  element: DesignElement,
  point: Point,
): ElementPatch {
  switch (gesture.kind) {
    case "move":
      return {
        x: gesture.startX + (point.x - gesture.origin.x),
        y: gesture.startY + (point.y - gesture.origin.y),
      };
    case "resize":
      return resizeElement(element, gesture.handle, point);
    case "rotate":
      return {
        rotation: normalizeAngle(pointerAngle(element, point) - gesture.angleOffset),
      };
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
