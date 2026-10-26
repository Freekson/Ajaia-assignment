type TiptapMark = { type?: string };

export type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
  content?: TiptapNode[];
};

function escapeMarkdown(text: string) {
  return text.replace(/([\\`*_[\]])/g, "\\$1");
}

function serializeInline(nodes: TiptapNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") {
        return "  \n";
      }
      if (node.type !== "text") {
        return serializeInline(node.content);
      }

      const rawText = node.text ?? "";
      const markTypes = new Set(node.marks?.map((mark) => mark.type));

      if (markTypes.has("code")) {
        const fence = rawText.includes("`") ? "``" : "`";
        return `${fence}${rawText}${fence}`;
      }

      let value = escapeMarkdown(rawText);
      if (markTypes.has("bold")) {
        value = `**${value}**`;
      }
      if (markTypes.has("italic")) {
        value = `*${value}*`;
      }
      if (markTypes.has("underline")) {
        value = `<u>${value}</u>`;
      }

      return value;
    })
    .join("");
}

function serializeList(node: TiptapNode, depth = 0): string {
  const ordered = node.type === "orderedList";
  const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;

  return (node.content ?? [])
    .map((item, index) => {
      const children = item.content ?? [];
      const firstBlock = children[0];
      const marker = ordered ? `${start + index}.` : "-";
      const indentation = "  ".repeat(depth);
      let output = `${indentation}${marker} ${serializeInline(firstBlock?.content)}`.trimEnd();

      for (const child of children.slice(1)) {
        if (child.type === "bulletList" || child.type === "orderedList") {
          output += `\n${serializeList(child, depth + 1)}`;
        } else {
          const continuation = serializeInline(child.content);
          if (continuation) {
            output += `\n${indentation}  ${continuation}`;
          }
        }
      }

      return output;
    })
    .join("\n");
}

function serializeBlock(node: TiptapNode): string {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content);
    case "heading": {
      const requestedLevel = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      const level = Math.min(6, Math.max(1, requestedLevel));
      return `${"#".repeat(level)} ${serializeInline(node.content)}`.trimEnd();
    }
    case "bulletList":
    case "orderedList":
      return serializeList(node);
    case "blockquote":
      return (node.content ?? [])
        .map(serializeBlock)
        .join("\n\n")
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n");
    case "horizontalRule":
      return "---";
    default:
      return serializeInline(node.content);
  }
}

export function tiptapToMarkdown(document: TiptapNode) {
  const markdown = (document.content ?? []).map(serializeBlock).join("\n\n").trimEnd();
  return markdown ? `${markdown}\n` : "";
}

export function markdownFilename(documentName: string) {
  const safeName = documentName
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 100);

  return `${safeName || "Untitled document"}.md`;
}
