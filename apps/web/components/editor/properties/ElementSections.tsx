"use client";

/**
 * Per-type property sections. Each one receives its element and emits patches;
 * none of them know about the editor store or the canvas.
 */

import type {
  ImageElement,
  ShapeElement,
  ShapeGeometry,
  TextAlign,
  TextElement,
  TextStyle,
} from "@pixel-studio/types";
import { SHAPE_LABELS } from "@/models/elements";
import type { ElementPatch } from "@/models/design";
import { FONT_FAMILIES, FONT_WEIGHTS } from "@/models/styles";
import {
  ActionButton,
  ColorField,
  NumberField,
  Row,
  Section,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/editor/properties/fields";
import {
  BorderEditor,
  FillEditor,
  ShadowEditor,
} from "@/components/editor/properties/StyleEditors";

type Emit = (patch: ElementPatch, session: string | null) => void;

/* ----------------------------- shapes ----------------------------- */

/** Geometry controls that only some shape kinds have. */
function GeometryControls({
  geometry,
  session,
  emit,
}: {
  geometry: ShapeGeometry;
  session: (field: string) => string;
  emit: Emit;
}) {
  switch (geometry.kind) {
    case "rectangle":
      return (
        <NumberField
          label="Corner radius"
          value={geometry.cornerRadius}
          min={0}
          onChange={(cornerRadius) =>
            emit({ geometry: { ...geometry, cornerRadius } }, session("radius"))
          }
        />
      );
    case "polygon":
      return (
        <NumberField
          label="Sides"
          value={geometry.sides}
          min={3}
          max={24}
          onChange={(sides) =>
            emit({ geometry: { ...geometry, sides } }, session("sides"))
          }
        />
      );
    case "star":
      return (
        <Row>
          <NumberField
            label="Points"
            value={geometry.points}
            min={3}
            max={24}
            onChange={(points) =>
              emit({ geometry: { ...geometry, points } }, session("points"))
            }
          />
          <NumberField
            label="Inner %"
            value={Math.round(geometry.innerRatio * 100)}
            min={5}
            max={95}
            onChange={(value) =>
              emit(
                { geometry: { ...geometry, innerRatio: value / 100 } },
                session("inner"),
              )
            }
          />
        </Row>
      );
    case "arrow":
      return (
        <NumberField
          label="Head size"
          value={geometry.headSize}
          min={1}
          onChange={(headSize) =>
            emit({ geometry: { ...geometry, headSize } }, session("head"))
          }
        />
      );
    case "ellipse":
    case "triangle":
    case "line":
      return null;
  }
}

export function ShapeSection({
  element,
  emit,
}: {
  element: ShapeElement;
  emit: Emit;
}) {
  const session = (field: string) => `property:${element.id}:${field}`;
  const geometryControls = (
    <GeometryControls
      geometry={element.geometry}
      session={session}
      emit={emit}
    />
  );

  return (
    <>
      {geometryControls && (
        <Section title={SHAPE_LABELS[element.geometry.kind]}>
          {geometryControls}
        </Section>
      )}
      <FillEditor
        fill={element.fill}
        onChange={(fill) => emit({ fill }, session("fill"))}
      />
      <BorderEditor
        border={element.border}
        onChange={(border) => emit({ border }, session("border"))}
      />
      <ShadowEditor
        shadow={element.shadow}
        onChange={(shadow) => emit({ shadow }, session("shadow"))}
      />
    </>
  );
}

/* ------------------------------ text ------------------------------ */

const ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justify" },
];

export function TextSection({
  element,
  emit,
}: {
  element: TextElement;
  emit: Emit;
}) {
  const session = (field: string) => `property:${element.id}:${field}`;
  const style = element.style;
  const setStyle = (patch: Partial<TextStyle>, field: string) =>
    emit({ style: patch }, session(field));

  return (
    <>
      <Section title="Text">
        <TextField
          label="Content"
          value={element.text}
          onChange={(text) => emit({ text }, session("text"))}
        />
        <SelectField
          label="Font family"
          value={style.fontFamily}
          options={FONT_FAMILIES.map((family) => ({
            value: family,
            label: family.split(",")[0],
          }))}
          onChange={(fontFamily) => setStyle({ fontFamily }, "fontFamily")}
        />
        <Row>
          <NumberField
            label="Size"
            value={style.fontSize}
            min={1}
            onChange={(fontSize) => setStyle({ fontSize }, "fontSize")}
          />
          <SelectField
            label="Weight"
            value={style.fontWeight}
            options={FONT_WEIGHTS.map((weight) => ({
              value: weight,
              label: String(weight),
            }))}
            onChange={(fontWeight) => setStyle({ fontWeight }, "fontWeight")}
          />
        </Row>
        <Row>
          <ToggleField
            label="Italic"
            active={style.italic}
            onChange={(italic) => setStyle({ italic }, "italic")}
          />
          <ToggleField
            label="Underline"
            active={style.underline}
            onChange={(underline) => setStyle({ underline }, "underline")}
          />
        </Row>
        <SelectField
          label="Alignment"
          value={style.align}
          options={ALIGN_OPTIONS}
          onChange={(align) => setStyle({ align }, "align")}
        />
        <Row>
          <NumberField
            label="Line height"
            value={style.lineHeight}
            min={0.5}
            step={0.05}
            onChange={(lineHeight) => setStyle({ lineHeight }, "lineHeight")}
          />
          <NumberField
            label="Tracking"
            value={style.letterSpacing}
            step={0.5}
            onChange={(letterSpacing) =>
              setStyle({ letterSpacing }, "letterSpacing")
            }
          />
        </Row>
        <ColorField
          label="Color"
          value={style.color}
          onChange={(color) => setStyle({ color }, "color")}
        />
      </Section>
      <ShadowEditor
        shadow={element.shadow}
        onChange={(shadow) => emit({ shadow }, session("shadow"))}
      />
    </>
  );
}

/* ----------------------------- images ----------------------------- */

export function ImageSection({
  element,
  emit,
}: {
  element: ImageElement;
  emit: Emit;
}) {
  const session = (field: string) => `property:${element.id}:${field}`;
  const crop = element.crop;

  /** Crop insets are edited in source pixels and clamped to the original. */
  const setCrop = (next: Partial<typeof crop>, field: string) => {
    const merged = { ...crop, ...next };
    emit(
      {
        crop: {
          x: Math.min(Math.max(0, merged.x), element.naturalWidth - 1),
          y: Math.min(Math.max(0, merged.y), element.naturalHeight - 1),
          width: Math.min(
            Math.max(1, merged.width),
            element.naturalWidth - Math.max(0, merged.x),
          ),
          height: Math.min(
            Math.max(1, merged.height),
            element.naturalHeight - Math.max(0, merged.y),
          ),
        },
      },
      session(field),
    );
  };

  return (
    <>
      <Section
        title="Image"
        actions={
          <ActionButton
            label="Reset crop"
            onClick={() =>
              emit(
                {
                  crop: {
                    x: 0,
                    y: 0,
                    width: element.naturalWidth,
                    height: element.naturalHeight,
                  },
                },
                null,
              )
            }
          />
        }
      >
        <p className="text-xs text-zinc-400">
          Source {element.naturalWidth} x {element.naturalHeight}
        </p>
        <Row>
          <NumberField
            label="Crop X"
            value={Math.round(crop.x)}
            min={0}
            onChange={(x) => setCrop({ x }, "cropX")}
          />
          <NumberField
            label="Crop Y"
            value={Math.round(crop.y)}
            min={0}
            onChange={(y) => setCrop({ y }, "cropY")}
          />
          <NumberField
            label="Crop W"
            value={Math.round(crop.width)}
            min={1}
            onChange={(width) => setCrop({ width }, "cropW")}
          />
          <NumberField
            label="Crop H"
            value={Math.round(crop.height)}
            min={1}
            onChange={(height) => setCrop({ height }, "cropH")}
          />
        </Row>
        <Row>
          <ToggleField
            label="Flip H"
            active={element.flipX}
            onChange={(flipX) => emit({ flipX }, null)}
          />
          <ToggleField
            label="Flip V"
            active={element.flipY}
            onChange={(flipY) => emit({ flipY }, null)}
          />
        </Row>
        <NumberField
          label="Corner radius"
          value={element.cornerRadius}
          min={0}
          onChange={(cornerRadius) =>
            emit({ cornerRadius }, session("radius"))
          }
        />
      </Section>
      <BorderEditor
        border={element.border}
        onChange={(border) => emit({ border }, session("border"))}
      />
      <ShadowEditor
        shadow={element.shadow}
        onChange={(shadow) => emit({ shadow }, session("shadow"))}
      />
    </>
  );
}
