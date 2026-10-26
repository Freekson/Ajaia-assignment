import { describe, expect, it } from "vitest";
import { markdownFilename, tiptapToMarkdown } from "@/lib/export-markdown";

describe("Markdown export", () => {
  it("preserves headings, marks, and lists", () => {
    expect(
      tiptapToMarkdown({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Project notes" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Bold", marks: [{ type: "bold" }] },
              { type: "text", text: " and " },
              { type: "text", text: "italic", marks: [{ type: "italic" }] },
              { type: "text", text: " plus " },
              { type: "text", text: "underline", marks: [{ type: "underline" }] },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "First item" }] }],
              },
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Second item" }] }],
              },
            ],
          },
        ],
      }),
    ).toBe(
      "## Project notes\n\n**Bold** and *italic* plus <u>underline</u>\n\n- First item\n- Second item\n",
    );
  });

  it("escapes Markdown characters and creates a safe filename", () => {
    expect(
      tiptapToMarkdown({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Use *stars*" }] }],
      }),
    ).toBe("Use \\*stars\\*\n");
    expect(markdownFilename("  Roadmap: Q4 / final?.md  ")).toBe("Roadmap- Q4 - final-.md");
    expect(markdownFilename("   ")).toBe("Untitled document.md");
  });
});
