/**
 * The design document: the unit that will be persisted and exchanged between
 * the editor and the API.
 */

import type { DesignElement } from "./elements";
import type { Fill } from "./styles";

export interface DesignDocument {
  readonly id: string;
  name: string;
  /** Design coordinate system; independent of zoom, pan and screen size. */
  width: number;
  height: number;
  background: Fill;
  /** Painted back-to-front: the last element is on top. */
  elements: DesignElement[];
}
