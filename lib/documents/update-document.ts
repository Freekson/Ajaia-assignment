import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canAccessDocument, canManageDocument } from "@/lib/access";

export type DocumentAccessRecord = {
  ownerId: string;
  version: number;
  shares: Array<{ userId: string }>;
};

export type DocumentUpdate = {
  id: string;
  userId: string;
  version: number;
  name?: string;
  content?: Record<string, unknown>;
};

type UpdatedDocument = {
  id: string;
  name: string;
  version: number;
  updatedAt: Date;
};

export interface DocumentUpdateStore {
  findAccess(id: string): Promise<DocumentAccessRecord | null>;
  updateIfCurrent(input: DocumentUpdate): Promise<boolean>;
  findUpdated(id: string): Promise<UpdatedDocument | null>;
}

export class DocumentUpdateError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 404 | 409,
    public readonly code: "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT",
    public readonly currentVersion?: number,
  ) {
    super(message);
    this.name = "DocumentUpdateError";
  }
}

export async function updateDocumentWithVersion(store: DocumentUpdateStore, input: DocumentUpdate) {
  const document = await store.findAccess(input.id);
  if (!document) throw new DocumentUpdateError("Document not found.", 404, "NOT_FOUND");
  if (!canAccessDocument(document, input.userId)) {
    throw new DocumentUpdateError("You do not have access to this document.", 403, "FORBIDDEN");
  }
  if (input.name !== undefined && !canManageDocument(document, input.userId)) {
    throw new DocumentUpdateError("Only the owner can rename this document.", 403, "FORBIDDEN");
  }

  const updated = await store.updateIfCurrent(input);
  if (!updated) {
    const latest = await store.findAccess(input.id);
    if (!latest) throw new DocumentUpdateError("Document not found.", 404, "NOT_FOUND");
    if (!canAccessDocument(latest, input.userId)) {
      throw new DocumentUpdateError("You do not have access to this document.", 403, "FORBIDDEN");
    }
    throw new DocumentUpdateError(
      "This document was modified in another session.",
      409,
      "VERSION_CONFLICT",
      latest.version,
    );
  }

  const result = await store.findUpdated(input.id);
  if (!result) throw new DocumentUpdateError("Document not found.", 404, "NOT_FOUND");
  return result;
}

export const prismaDocumentUpdateStore: DocumentUpdateStore = {
  findAccess(id) {
    return db.document.findUnique({
      where: { id },
      select: { ownerId: true, version: true, shares: { select: { userId: true } } },
    });
  },
  async updateIfCurrent(input) {
    const requireOwner = input.name !== undefined;
    const result = await db.document.updateMany({
      where: {
        id: input.id,
        version: input.version,
        ...(requireOwner
          ? { ownerId: input.userId }
          : { OR: [{ ownerId: input.userId }, { shares: { some: { userId: input.userId } } }] }),
      },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.content !== undefined ? { content: input.content as Prisma.InputJsonValue } : {}),
        version: { increment: 1 },
      },
    });
    return result.count === 1;
  },
  findUpdated(id) {
    return db.document.findUnique({
      where: { id },
      select: { id: true, name: true, version: true, updatedAt: true },
    });
  },
};
