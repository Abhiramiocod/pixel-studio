"use client";

/**
 * Align and distribute buttons. Alignment runs entirely in document
 * coordinates; this component only dispatches the intent.
 */

import type { EditorApi } from "@/editor/useEditor";
import type { AlignMode, DistributeAxis } from "@/engine/alignment/align";
import { ActionButton } from "@/components/editor/properties/fields";

const ALIGN_ACTIONS: ReadonlyArray<{ mode: AlignMode; label: string }> = [
  { mode: "left", label: "Left" },
  { mode: "center-horizontal", label: "Center" },
  { mode: "right", label: "Right" },
  { mode: "top", label: "Top" },
  { mode: "middle", label: "Middle" },
  { mode: "bottom", label: "Bottom" },
];

const DISTRIBUTE_ACTIONS: ReadonlyArray<{
  axis: DistributeAxis;
  label: string;
}> = [
  { axis: "horizontal", label: "Distribute H" },
  { axis: "vertical", label: "Distribute V" },
];

export function AlignmentControls({ editor }: { editor: EditorApi }) {
  const count = editor.state.selectedIds.length;
  const hint =
    count > 1 ? "Aligns to the selection bounds" : "Aligns to the canvas";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1">
        {ALIGN_ACTIONS.map((action) => (
          <ActionButton
            key={action.mode}
            label={action.label}
            disabled={count === 0}
            onClick={() => editor.align(action.mode)}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {DISTRIBUTE_ACTIONS.map((action) => (
          <ActionButton
            key={action.axis}
            label={action.label}
            title="Needs at least three elements"
            disabled={count < 3}
            onClick={() => editor.distribute(action.axis)}
          />
        ))}
      </div>
      <p className="text-[11px] text-zinc-400">{hint}</p>
    </div>
  );
}
