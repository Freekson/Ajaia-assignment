import { describe, expect, it } from "vitest";
import { canAccessDocument, canManageDocument } from "@/lib/access";

const document = { ownerId: "alice", shares: [{ userId: "bob" }] };

describe("document permissions", () => {
  it("allows the owner and shared user, while rejecting everyone else", () => {
    expect(canAccessDocument(document, "alice")).toBe(true);
    expect(canAccessDocument(document, "bob")).toBe(true);
    expect(canAccessDocument(document, "mallory")).toBe(false);
  });

  it("only allows the owner to manage document sharing", () => {
    expect(canManageDocument(document, "alice")).toBe(true);
    expect(canManageDocument(document, "bob")).toBe(false);
  });
});
