import { describe, expect, it } from "vitest";
import { canAccessDocument, canEditDocument, canManageDocument } from "@/lib/access";

const document = {
  ownerId: "alice",
  shares: [
    { userId: "bob", role: "EDITOR" as const },
    { userId: "charlie", role: "VIEWER" as const },
  ],
};

describe("document permissions", () => {
  it("allows the owner and shared user, while rejecting everyone else", () => {
    expect(canAccessDocument(document, "alice")).toBe(true);
    expect(canAccessDocument(document, "bob")).toBe(true);
    expect(canAccessDocument(document, "charlie")).toBe(true);
    expect(canAccessDocument(document, "mallory")).toBe(false);
  });

  it("allows content edits only for the owner and editors", () => {
    expect(canEditDocument(document, "alice")).toBe(true);
    expect(canEditDocument(document, "bob")).toBe(true);
    expect(canEditDocument(document, "charlie")).toBe(false);
    expect(canEditDocument(document, "mallory")).toBe(false);
  });

  it("only allows the owner to manage document sharing", () => {
    expect(canManageDocument(document, "alice")).toBe(true);
    expect(canManageDocument(document, "bob")).toBe(false);
  });
});
