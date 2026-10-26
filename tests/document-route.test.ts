import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentUpdateError } from "@/lib/documents/update-document";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  updateDocumentWithVersion: vi.fn(),
  findUnique: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUserId: mocks.getCurrentUserId }));
vi.mock("@/lib/db", () => ({
  db: { document: { findUnique: mocks.findUnique, delete: mocks.deleteDocument } },
}));
vi.mock("@/lib/documents/update-document", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/documents/update-document")>();
  return {
    ...actual,
    prismaDocumentUpdateStore: {},
    updateDocumentWithVersion: mocks.updateDocumentWithVersion,
  };
});

import { DELETE, PATCH } from "@/app/api/documents/[id]/route";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/documents/doc-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUserId.mockResolvedValue("alice");
});

describe("PATCH /api/documents/:id", () => {
  it("returns 400 for malformed document input", async () => {
    const response = await PATCH(patchRequest({ content: { type: "doc" } }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
  });

  it("returns 403 without exposing document content", async () => {
    mocks.updateDocumentWithVersion.mockRejectedValue(
      new DocumentUpdateError("You do not have access to this document.", 403, "FORBIDDEN"),
    );
    const response = await PATCH(patchRequest({ version: 1, content: { type: "doc" } }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You do not have access to this document.",
      code: "FORBIDDEN",
    });
  });

  it("returns a structured 409 version conflict", async () => {
    mocks.updateDocumentWithVersion.mockRejectedValue(
      new DocumentUpdateError(
        "This document was modified in another session.",
        409,
        "VERSION_CONFLICT",
        2,
      ),
    );
    const response = await PATCH(patchRequest({ version: 1, content: { type: "doc" } }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "This document was modified in another session.",
      code: "VERSION_CONFLICT",
      currentVersion: 2,
    });
  });

  it("returns the new version after a successful update", async () => {
    mocks.updateDocumentWithVersion.mockResolvedValue({
      id: "doc-1",
      name: "Notes",
      version: 2,
      updatedAt: new Date("2026-01-01"),
    });
    const response = await PATCH(patchRequest({ version: 1, content: { type: "doc" } }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "doc-1", version: 2 });
  });
});

describe("DELETE /api/documents/:id", () => {
  it("prevents a non-owner from deleting a shared document", async () => {
    mocks.findUnique.mockResolvedValue({ ownerId: "demo-bob" });

    const response = await DELETE(
      new Request("http://localhost/api/documents/doc-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "doc-1" }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Only the owner can delete this document." });
    expect(mocks.deleteDocument).not.toHaveBeenCalled();
  });

  it("allows the owner to delete a document", async () => {
    mocks.findUnique.mockResolvedValue({ ownerId: "alice" });
    mocks.deleteDocument.mockResolvedValue({ id: "doc-1" });

    const response = await DELETE(
      new Request("http://localhost/api/documents/doc-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "doc-1" }) },
    );

    expect(response.status).toBe(204);
    expect(mocks.deleteDocument).toHaveBeenCalledWith({ where: { id: "doc-1" } });
  });
});
