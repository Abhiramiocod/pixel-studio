"use client";

import { useEditor } from "@/editor/useEditor";
import { useEditorShortcuts } from "@/editor/useEditorShortcuts";
import { CanvasStage } from "@/components/editor/CanvasStage";
import { ElementsPanel } from "@/components/editor/ElementsPanel";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { Toolbar } from "@/components/editor/Toolbar";
import { ZoomControls } from "@/components/editor/ZoomControls";

export function Editor() {
  const editor = useEditor();
  const { document: doc, selectedIds, camera, tool } = editor.state;

  useEditorShortcuts(editor);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-900">
      <Toolbar
        tool={tool}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onToolChange={editor.setTool}
        onUndo={editor.undo}
        onRedo={editor.redo}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
          <ElementsPanel
            onAdd={(elementTool) => {
              const center = { x: doc.width / 2, y: doc.height / 2 };
              if (elementTool === "rectangle") editor.insertRectangle(center);
              else editor.insertText(center);
            }}
          />
          <LayersPanel
            elements={doc.elements}
            selectedIds={selectedIds}
            onSelect={editor.selectOne}
            onReorder={editor.reorder}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <CanvasStage editor={editor} />
        </main>

        <PropertiesPanel
          element={editor.soleSelection}
          selectionCount={selectedIds.length}
          onChange={editor.patchSelection}
          onDelete={editor.deleteSelection}
        />
      </div>

      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-4 text-xs text-zinc-500">
        <span>
          {doc.elements.length} element{doc.elements.length === 1 ? "" : "s"}
          {selectedIds.length > 0 && ` - ${selectedIds.length} selected`}
        </span>
        <span className="hidden sm:inline">
          Space + drag to pan - scroll to pan - Ctrl/Cmd + scroll to zoom
        </span>
        <ZoomControls
          zoom={camera.zoom}
          onZoomIn={editor.zoomIn}
          onZoomOut={editor.zoomOut}
          onZoomTo={editor.zoomTo}
          onZoomToFit={editor.zoomToFit}
        />
      </footer>
    </div>
  );
}
