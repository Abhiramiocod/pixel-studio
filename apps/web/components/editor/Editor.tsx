"use client";

/**
 * Editor shell: lays out the panels and owns the few pieces of UI-only state
 * (the pending shape kind, the hidden file input). All design state lives in
 * the editor store.
 */

import type {
  ShapeKind,
} from "@pixel-studio/types";
import { useRef, useState } from "react";

import { useEditor } from "@/editor/useEditor";
import { useEditorShortcuts } from "@/editor/useEditorShortcuts";
import { readImageFile } from "@/engine/images/imageCache";
import { CanvasStage } from "@/components/editor/canvas/CanvasStage";
import { ElementsPanel } from "@/components/editor/panels/ElementsPanel";
import { LayersPanel } from "@/components/editor/layers/LayersPanel";
import { PropertiesPanel } from "@/components/editor/properties/PropertiesPanel";
import { Toolbar } from "@/components/editor/toolbar/Toolbar";
import { ZoomControls } from "@/components/editor/toolbar/ZoomControls";

export function Editor() {
  const editor = useEditor();
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEditorShortcuts(editor);

  const { document: doc, selectedIds, camera } = editor.state;
  const documentCenter = { x: doc.width / 2, y: doc.height / 2 };

  const handleImageFile = async (file: File) => {
    try {
      const { src, width, height } = await readImageFile(file);
      editor.insertImage(src, width, height, documentCenter, file.name);
      setImageError(null);
    } catch {
      setImageError("That image could not be loaded.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-900">
      <Toolbar
        editor={editor}
        shapeKind={shapeKind}
        onShapeKindChange={setShapeKind}
        onRequestImage={() => fileInputRef.current?.click()}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
          <ElementsPanel
            onInsertShape={(kind) => editor.insertShape(kind, documentCenter)}
            onInsertText={() => editor.insertText(documentCenter)}
            onInsertFrame={() => editor.insertFrame(documentCenter)}
            onRequestImage={() => fileInputRef.current?.click()}
          />
          <LayersPanel editor={editor} />
        </aside>

        <main className="min-w-0 flex-1">
          <CanvasStage editor={editor} shapeKind={shapeKind} />
        </main>

        <PropertiesPanel editor={editor} />
      </div>

      <footer className="flex h-10 shrink-0 items-center justify-between gap-4 border-t border-zinc-200 bg-white px-4 text-xs text-zinc-500">
        <span>
          {doc.elements.length} top-level element
          {doc.elements.length === 1 ? "" : "s"}
          {selectedIds.length > 0 && ` - ${selectedIds.length} selected`}
          {imageError && <span className="ml-2 text-red-600">{imageError}</span>}
        </span>
        <span className="hidden lg:inline">
          Space + drag pans - Ctrl/Cmd + scroll zooms - Alt disables snapping -
          double-click enters a group
        </span>
        <ZoomControls
          zoom={camera.zoom}
          onZoomIn={editor.zoomIn}
          onZoomOut={editor.zoomOut}
          onZoomTo={editor.zoomTo}
          onZoomToFit={editor.zoomToFit}
        />
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImageFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
