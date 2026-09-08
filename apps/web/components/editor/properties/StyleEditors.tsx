"use client";

/**
 * Editors for the shared style objects: fill, border and shadow.
 * They emit whole style values, which the document patch replaces wholesale.
 */

import type {
  Border,
  BorderStyle,
  Fill,
  Shadow,
} from "@pixel-studio/types";
import { DEFAULT_BORDER, DEFAULT_SHADOW, createLinearGradient, createRadialGradient, createSolidFill, primaryFillColor } from "@/models/styles";
import {
  ActionButton,
  ColorField,
  NumberField,
  Row,
  Section,
  SelectField,
} from "@/components/editor/properties/fields";

const FILL_TYPES = [
  { value: "solid" as const, label: "Solid" },
  { value: "linear-gradient" as const, label: "Linear gradient" },
  { value: "radial-gradient" as const, label: "Radial gradient" },
];

/** Switches fill type while carrying the current colours across. */
function convertFill(fill: Fill, type: Fill["type"]): Fill {
  const first = primaryFillColor(fill);
  const second =
    fill.type === "solid" ? "#ffffff" : (fill.stops.at(-1)?.color ?? "#ffffff");

  switch (type) {
    case "solid":
      return createSolidFill(first, fill.type === "solid" ? fill.opacity : 1);
    case "linear-gradient":
      return createLinearGradient(
        first,
        second,
        fill.type === "linear-gradient" ? fill.angle : 90,
      );
    case "radial-gradient":
      return createRadialGradient(first, second);
  }
}

function setStopColor(fill: Fill, index: number, color: string): Fill {
  if (fill.type === "solid") return { ...fill, color };
  const stops = fill.stops.map((stop, i) =>
    i === index ? { ...stop, color } : stop,
  );
  return { ...fill, stops };
}

export function FillEditor({
  label = "Fill",
  fill,
  onChange,
}: {
  label?: string;
  fill: Fill;
  onChange: (fill: Fill) => void;
}) {
  return (
    <Section title={label}>
      <SelectField
        label="Type"
        value={fill.type}
        options={FILL_TYPES}
        onChange={(type) => onChange(convertFill(fill, type))}
      />

      {fill.type === "solid" ? (
        <Row columns={1}>
          <ColorField
            label="Color"
            value={fill.color}
            onChange={(color) => onChange({ ...fill, color })}
          />
          <NumberField
            label="Fill opacity %"
            value={Math.round(fill.opacity * 100)}
            min={0}
            max={100}
            onChange={(value) => onChange({ ...fill, opacity: value / 100 })}
          />
        </Row>
      ) : (
        <Row columns={1}>
          <ColorField
            label="From"
            value={fill.stops[0]?.color ?? "#000000"}
            onChange={(color) => onChange(setStopColor(fill, 0, color))}
          />
          <ColorField
            label="To"
            value={fill.stops.at(-1)?.color ?? "#ffffff"}
            onChange={(color) =>
              onChange(setStopColor(fill, fill.stops.length - 1, color))
            }
          />
          {fill.type === "linear-gradient" ? (
            <NumberField
              label="Angle"
              value={Math.round(fill.angle)}
              suffix="deg"
              onChange={(angle) => onChange({ ...fill, angle })}
            />
          ) : (
            <NumberField
              label="Radius %"
              value={Math.round(fill.radius * 100)}
              min={1}
              max={200}
              onChange={(value) => onChange({ ...fill, radius: value / 100 })}
            />
          )}
        </Row>
      )}
    </Section>
  );
}

const BORDER_STYLES = [
  { value: "solid" as BorderStyle, label: "Solid" },
  { value: "dashed" as BorderStyle, label: "Dashed" },
  { value: "dotted" as BorderStyle, label: "Dotted" },
];

export function BorderEditor({
  border,
  onChange,
}: {
  border: Border | null;
  onChange: (border: Border | null) => void;
}) {
  return (
    <Section
      title="Border"
      actions={
        <ActionButton
          label={border ? "Remove" : "Add"}
          onClick={() => onChange(border ? null : { ...DEFAULT_BORDER })}
        />
      }
    >
      {border && (
        <Row columns={1}>
          <ColorField
            label="Color"
            value={border.color}
            onChange={(color) => onChange({ ...border, color })}
          />
          <Row>
            <NumberField
              label="Width"
              value={border.width}
              min={0}
              onChange={(width) => onChange({ ...border, width })}
            />
            <NumberField
              label="Opacity %"
              value={Math.round(border.opacity * 100)}
              min={0}
              max={100}
              onChange={(value) =>
                onChange({ ...border, opacity: value / 100 })
              }
            />
          </Row>
          <SelectField
            label="Style"
            value={border.style}
            options={BORDER_STYLES}
            onChange={(style) => onChange({ ...border, style })}
          />
        </Row>
      )}
    </Section>
  );
}

export function ShadowEditor({
  shadow,
  onChange,
}: {
  shadow: Shadow | null;
  onChange: (shadow: Shadow | null) => void;
}) {
  return (
    <Section
      title="Shadow"
      actions={
        <ActionButton
          label={shadow ? "Remove" : "Add"}
          onClick={() => onChange(shadow ? null : { ...DEFAULT_SHADOW })}
        />
      }
    >
      {shadow && (
        <Row columns={1}>
          <Row>
            <NumberField
              label="Offset X"
              value={shadow.x}
              onChange={(x) => onChange({ ...shadow, x })}
            />
            <NumberField
              label="Offset Y"
              value={shadow.y}
              onChange={(y) => onChange({ ...shadow, y })}
            />
            <NumberField
              label="Blur"
              value={shadow.blur}
              min={0}
              onChange={(blur) => onChange({ ...shadow, blur })}
            />
            <NumberField
              label="Spread"
              value={shadow.spread}
              onChange={(spread) => onChange({ ...shadow, spread })}
            />
          </Row>
          <ColorField
            label="Color"
            value={shadow.color}
            onChange={(color) => onChange({ ...shadow, color })}
          />
          <NumberField
            label="Opacity %"
            value={Math.round(shadow.opacity * 100)}
            min={0}
            max={100}
            onChange={(value) => onChange({ ...shadow, opacity: value / 100 })}
          />
        </Row>
      )}
    </Section>
  );
}
