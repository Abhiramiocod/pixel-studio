"use client";

import { useEffect } from "react";

import { useEditor } from "@/editor/useEditor";
import { CanvasStage } from "@/components/editor/CanvasStage";
import { ElementsPanel } from "@/components/editor/ElementsPanel";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { Toolbar } from "@/components/editor/Toolbar";

export function Editor() {
  const editor = useEditor();
  const { document: doc, selectedId, tool } = editor.state;
  const { selectedElement, deleteElement } = editor;

  const documentCenter = { x: doc.width / 2, y: doc.height / 2 };

  // Delete / Backspace removes the selection, unless the user is typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (isTextEntryTarget(event.target)) return;
      if (!selectedElement) return;
      event.preventDefault();
      deleteElement(selectedElement.id);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedElement, deleteElement]);

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
        <ElementsPanel
          elements={doc.elements}
          selectedId={selectedId}
          onAddRectangle={() => editor.insertRectangle(documentCenter)}
          onAddText={() => editor.insertText(documentCenter)}
          onSelect={editor.select}
        />

        <main className="min-w-0 flex-1">
          <CanvasStage
            document={doc}
            selectedId={selectedId}
            tool={tool}
            onSelect={editor.select}
            onBeginTransaction={editor.beginTransaction}
            onTransform={editor.updateElement}
            onInsertRectangle={editor.insertRectangle}
            onInsertText={editor.insertText}
          />
        </main>

        <PropertiesPanel
          element={selectedElement}
          onChange={(patch) => {
            if (selectedElement) editor.updateElement(selectedElement.id, patch);
          }}
          onDelete={() => {
            if (selectedElement) deleteElement(selectedElement.id);
          }}
        />
      </div>
    </div>
  );
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  );
}
