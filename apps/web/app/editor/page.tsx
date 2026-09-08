import type { Metadata } from "next";

import { Editor } from "@/components/editor/Editor";

export const metadata: Metadata = {
  title: "Editor - Pixel Studio",
  description: "Visual design editor",
};

export default function EditorPage() {
  return <Editor />;
}
