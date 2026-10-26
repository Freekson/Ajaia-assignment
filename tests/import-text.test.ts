import { describe, expect, it } from "vitest";
import { textToTiptapDocument, validateTextFile } from "@/lib/import-text";

describe("text import", () => {
  it("converts lines into valid Tiptap paragraphs", () => {
    expect(textToTiptapDocument("First line\r\n\r\nThird line")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First line" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "Third line" }] },
      ],
    });
  });

  it("rejects unsupported files", () => {
    expect(validateTextFile({ name: "notes.pdf", size: 100, type: "application/pdf" })).toMatch(/\.txt/);
  });
});
