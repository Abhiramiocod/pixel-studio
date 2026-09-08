"use client";

/**
 * The properties panel composes small sections based on what is selected:
 * shared geometry first, then type-specific controls, then multi-selection
 * tools. It holds no state of its own.
 */

import type {
  DesignElement,
} from "@pixel-studio/types";
import type { ElementPatch } from "@/models/design";
import type { EditorApi } from "@/editor/useEditor";
import {
  ActionButton,
  NumberField,
  Row,
  Section,
  TextField,
  ToggleField,
} from "@/components/editor/properties/fields";
import {
  ImageSection,
  ShapeSection,
  TextSection,
} from "@/components/editor/properties/ElementSections";
import { FillEditor } from "@/components/editor/properties/StyleEditors";
import { AlignmentControls } from "@/components/editor/toolbar/AlignmentControls";

export function PropertiesPanel({ editor }: { editor: EditorApi }) {
  const element = editor.soleSelection;
  const count = editor.state.selectedIds.length;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-zinc-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Properties
      </h2>

      {element ? (
        <SingleSelection element={element} editor={editor} />
      ) : count > 1 ? (
        <MultiSelection editor={editor} count={count} />
      ) : (
        <p className="text-xs text-zinc-400">
          Select an element to edit its properties.
        </p>
      )}
    </aside>
  );
}

function SingleSelection({
  element,
  editor,
}: {
  element: DesignElement;
  editor: EditorApi;
}) {
  const emit = (patch: ElementPatch, session: string | null) =>
    editor.patchElement(element.id, patch, session);
  const session = (field: string) => `property:${element.id}:${field}`;

  return (
    <>
      <Section title={`${element.type} properties`}>
        <TextField
          label="Name"
          value={element.name}
          onChange={(name) => emit({ name }, session("name"))}
        />
      </Section>

      <Section title="Position">
        <Row>
          <NumberField
            label="X"
            value={Math.round(element.x)}
            onChange={(x) => emit({ x }, session("x"))}
          />
          <NumberField
            label="Y"
            value={Math.round(element.y)}
            onChange={(y) => emit({ y }, session("y"))}
          />
        </Row>
      </Section>

      <Section title="Size">
        <Row>
          <NumberField
            label="Width"
            value={Math.round(element.width)}
            min={1}
            onChange={(width) => emit({ width }, session("width"))}
          />
          <NumberField
            label="Height"
            value={Math.round(element.height)}
            min={1}
            onChange={(height) => emit({ height }, session("height"))}
          />
        </Row>
      </Section>

      <Section title="Transform">
        <Row>
          <NumberField
            label="Rotation"
            value={Math.round(element.rotation)}
            suffix="deg"
            onChange={(rotation) => emit({ rotation }, session("rotation"))}
          />
          <NumberField
            label="Opacity %"
            value={Math.round(element.opacity * 100)}
            min={0}
            max={100}
            onChange={(value) =>
              emit({ opacity: value / 100 }, session("opacity"))
            }
          />
        </Row>
        <Row>
          <ToggleField
            label={element.visible ? "Visible" : "Hidden"}
            active={element.visible}
            onChange={(visible) => emit({ visible }, null)}
          />
          <ToggleField
            label={element.locked ? "Locked" : "Unlocked"}
            active={element.locked}
            onChange={(locked) => emit({ locked }, null)}
          />
        </Row>
      </Section>

      {element.type === "shape" && (
        <ShapeSection element={element} emit={emit} />
      )}
      {element.type === "text" && <TextSection element={element} emit={emit} />}
      {element.type === "image" && (
        <ImageSection element={element} emit={emit} />
      )}
      {element.type === "frame" && (
        <>
          <Section title="Frame">
            <Row>
              <NumberField
                label="Corner radius"
                value={element.cornerRadius}
                min={0}
                onChange={(cornerRadius) =>
                  emit({ cornerRadius }, session("radius"))
                }
              />
              <ToggleField
                label="Clip content"
                active={element.clipContent}
                onChange={(clipContent) => emit({ clipContent }, null)}
              />
            </Row>
          </Section>
          <FillEditor
            label="Background"
            fill={element.fill}
            onChange={(fill) => emit({ fill }, session("fill"))}
          />
        </>
      )}

      <Section title="Arrange">
        <AlignmentControls editor={editor} />
      </Section>

      <div className="flex gap-2">
        {editor.canUngroup && (
          <ActionButton label="Ungroup" onClick={editor.ungroup} />
        )}
        <ActionButton
          label="Delete"
          tone="danger"
          onClick={editor.deleteSelection}
        />
      </div>
    </>
  );
}

function MultiSelection({
  editor,
  count,
}: {
  editor: EditorApi;
  count: number;
}) {
  return (
    <>
      <p className="text-xs text-zinc-500">{count} elements selected</p>

      <Section title="Align & distribute">
        <AlignmentControls editor={editor} />
      </Section>

      <Section title="Shared appearance">
        <Row>
          <NumberField
            label="Set opacity %"
            value={100}
            min={0}
            max={100}
            onChange={(value) =>
              editor.patchSelection(
                { opacity: value / 100 },
                "selection:opacity",
              )
            }
          />
          <NumberField
            label="Set rotation"
            value={0}
            suffix="deg"
            onChange={(rotation) =>
              editor.patchSelection({ rotation }, "selection:rotation")
            }
          />
        </Row>
        <p className="text-xs text-zinc-400">
          Values apply to every selected element.
        </p>
      </Section>

      <div className="flex gap-2">
        <ActionButton
          label="Group"
          disabled={!editor.canGroup}
          onClick={editor.group}
        />
        {editor.canUngroup && (
          <ActionButton label="Ungroup" onClick={editor.ungroup} />
        )}
        <ActionButton
          label="Delete"
          tone="danger"
          onClick={editor.deleteSelection}
        />
      </div>
    </>
  );
}
