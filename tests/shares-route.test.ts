import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  findDocument: vi.fn(),
  findUser: vi.fn(),
  upsertShare: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUserId: mocks.getCurrentUserId }));
vi.mock("@/lib/db", () => ({
  db: {
    document: { findUnique: mocks.findDocument },
    user: { findUnique: mocks.findUser },
    documentShare: {
      findMany: vi.fn(),
      upsert: mocks.upsertShare,
      deleteMany: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/documents/[id]/shares/route";

function shareRequest(body: unknown) {
  return new Request("http://localhost/api/documents/doc-1/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUserId.mockResolvedValue("alice");
  mocks.findDocument.mockResolvedValue({ ownerId: "alice" });
  mocks.findUser.mockResolvedValue({ id: "bob" });
  mocks.upsertShare.mockResolvedValue({ documentId: "doc-1", userId: "bob", role: "VIEWER" });
});

describe("POST /api/documents/:id/shares", () => {
  it("rejects an invalid role", async () => {
    const response = await POST(shareRequest({ userId: "bob", role: "OWNER" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.upsertShare).not.toHaveBeenCalled();
  });

  it("prevents a non-owner from changing roles", async () => {
    mocks.findDocument.mockResolvedValue({ ownerId: "someone-else" });
    const response = await POST(shareRequest({ userId: "bob", role: "EDITOR" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.upsertShare).not.toHaveBeenCalled();
  });

  it("lets the owner grant viewer access", async () => {
    const response = await POST(shareRequest({ userId: "bob", role: "VIEWER" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.upsertShare).toHaveBeenCalledWith({
      where: { documentId_userId: { documentId: "doc-1", userId: "bob" } },
      create: { documentId: "doc-1", userId: "bob", role: "VIEWER" },
      update: { role: "VIEWER" },
    });
  });
});
