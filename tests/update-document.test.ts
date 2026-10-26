import { describe, expect, it, vi } from "vitest";
import {
  DocumentUpdateError,
  type DocumentUpdateStore,
  updateDocumentWithVersion,
} from "@/lib/documents/update-document";

function createStore(overrides: Partial<DocumentUpdateStore> = {}): DocumentUpdateStore {
  return {
    findAccess: vi.fn().mockResolvedValue({
      ownerId: "alice",
      version: 1,
      shares: [
        { userId: "bob", role: "EDITOR" },
        { userId: "charlie", role: "VIEWER" },
      ],
    }),
    updateIfCurrent: vi.fn().mockResolvedValue(true),
    findUpdated: vi
      .fn()
      .mockResolvedValue({ id: "doc-1", name: "Notes", version: 2, updatedAt: new Date() }),
    ...overrides,
  };
}

describe("versioned document updates", () => {
  it("allows an owner to update the document", async () => {
    const store = createStore();
    const result = await updateDocumentWithVersion(store, {
      id: "doc-1",
      userId: "alice",
      version: 1,
      name: "Renamed",
    });
    expect(result.version).toBe(2);
    expect(store.updateIfCurrent).toHaveBeenCalledOnce();
  });

  it("allows a shared user to edit content", async () => {
    const store = createStore();
    await expect(
      updateDocumentWithVersion(store, {
        id: "doc-1",
        userId: "bob",
        version: 1,
        content: { type: "doc" },
      }),
    ).resolves.toMatchObject({ version: 2 });
  });

  it("prevents a viewer from editing content", async () => {
    const store = createStore();
    await expect(
      updateDocumentWithVersion(store, {
        id: "doc-1",
        userId: "charlie",
        version: 1,
        content: { type: "doc" },
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "You have view-only access to this document.",
    });
    expect(store.updateIfCurrent).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized user before an update is attempted", async () => {
    const store = createStore();
    await expect(
      updateDocumentWithVersion(store, {
        id: "doc-1",
        userId: "mallory",
        version: 1,
        content: { type: "doc" },
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(store.updateIfCurrent).not.toHaveBeenCalled();
  });

  it("prevents a shared user from renaming the document", async () => {
    const store = createStore();
    await expect(
      updateDocumentWithVersion(store, {
        id: "doc-1",
        userId: "bob",
        version: 1,
        name: "Not allowed",
      }),
    ).rejects.toBeInstanceOf(DocumentUpdateError);
    expect(store.updateIfCurrent).not.toHaveBeenCalled();
  });

  it("reports a version conflict without overwriting", async () => {
    const store = createStore({
      updateIfCurrent: vi.fn().mockResolvedValue(false),
      findAccess: vi
        .fn()
        .mockResolvedValueOnce({ ownerId: "alice", version: 1, shares: [] })
        .mockResolvedValueOnce({ ownerId: "alice", version: 2, shares: [] }),
    });
    await expect(
      updateDocumentWithVersion(store, {
        id: "doc-1",
        userId: "alice",
        version: 1,
        content: { type: "doc" },
      }),
    ).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT", currentVersion: 2 });
  });

  it("reports a role downgrade instead of a version conflict", async () => {
    const store = createStore({
      updateIfCurrent: vi.fn().mockResolvedValue(false),
      findAccess: vi
        .fn()
        .mockResolvedValueOnce({
          ownerId: "alice",
          version: 1,
          shares: [{ userId: "bob", role: "EDITOR" }],
        })
        .mockResolvedValueOnce({
          ownerId: "alice",
          version: 1,
          shares: [{ userId: "bob", role: "VIEWER" }],
        }),
    });

    await expect(
      updateDocumentWithVersion(store, {
        id: "doc-1",
        userId: "bob",
        version: 1,
        content: { type: "doc" },
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});
