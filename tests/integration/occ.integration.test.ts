import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  prismaDocumentUpdateStore,
  updateDocumentWithVersion,
} from "@/lib/documents/update-document";

const ownerId = `occ-owner-${Date.now()}`;
const collaboratorId = `role-user-${Date.now()}`;
let documentId: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("ajaia_docs_test"))
    throw new Error("Integration tests require ajaia_docs_test.");
  await db.user.createMany({
    data: [
      { id: ownerId, name: "OCC Owner", email: `${ownerId}@test.local` },
      {
        id: collaboratorId,
        name: "Role User",
        email: `${collaboratorId}@test.local`,
      },
    ],
  });
  const document = await db.document.create({
    data: { ownerId, name: "OCC test", content: { type: "doc", content: [] } },
  });
  documentId = document.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [ownerId, collaboratorId] } } });
  await db.$disconnect();
});

describe("PostgreSQL optimistic concurrency", () => {
  it("allows exactly one of two concurrent writes based on the same version", async () => {
    const results = await Promise.allSettled([
      updateDocumentWithVersion(prismaDocumentUpdateStore, {
        id: documentId,
        userId: ownerId,
        version: 1,
        content: { type: "doc", content: [{ type: "paragraph", text: "first" }] },
      }),
      updateDocumentWithVersion(prismaDocumentUpdateStore, {
        id: documentId,
        userId: ownerId,
        version: 1,
        content: { type: "doc", content: [{ type: "paragraph", text: "second" }] },
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { status: 409, code: "VERSION_CONFLICT" },
    });
    const stored = await db.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(stored.version).toBe(2);
    expect([
      { type: "doc", content: [{ type: "paragraph", text: "first" }] },
      { type: "doc", content: [{ type: "paragraph", text: "second" }] },
    ]).toContainEqual(stored.content);
  });

  it("enforces viewer and editor roles in PostgreSQL updates", async () => {
    const roleDocument = await db.document.create({
      data: {
        ownerId,
        name: "Role test",
        content: { type: "doc", content: [] },
        shares: { create: { userId: collaboratorId, role: "VIEWER" } },
      },
    });

    await expect(
      updateDocumentWithVersion(prismaDocumentUpdateStore, {
        id: roleDocument.id,
        userId: collaboratorId,
        version: 1,
        content: { type: "doc", content: [{ type: "paragraph", text: "blocked" }] },
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    await db.documentShare.update({
      where: {
        documentId_userId: { documentId: roleDocument.id, userId: collaboratorId },
      },
      data: { role: "EDITOR" },
    });

    await expect(
      updateDocumentWithVersion(prismaDocumentUpdateStore, {
        id: roleDocument.id,
        userId: collaboratorId,
        version: 1,
        content: { type: "doc", content: [{ type: "paragraph", text: "allowed" }] },
      }),
    ).resolves.toMatchObject({ version: 2 });
  });
});
