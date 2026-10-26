import { MAX_IMPORT_BYTES } from "@/lib/constants";

export type TiptapDocument = {
  type: "doc";
  content: Array<{ type: "paragraph"; content?: Array<{ type: "text"; text: string }> }>;
};

export function validateTextFile(file: Pick<File, "name" | "size" | "type">) {
  if (!file.name.toLowerCase().endsWith(".txt") || (file.type && file.type !== "text/plain")) {
    return "Only .txt files are supported.";
  }
  if (file.size > MAX_IMPORT_BYTES) return "The file must be 1 MB or smaller.";
  return null;
}

export function textToTiptapDocument(text: string): TiptapDocument {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return {
    type: "doc",
    content: (lines.length ? lines : [""]).map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text" as const, text: line }] } : {}),
    })),
  };
}
