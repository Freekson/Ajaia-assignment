import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { canAccessDocument } from "@/lib/access";
import {
  DocumentUpdateError,
  prismaDocumentUpdateStore,
  updateDocumentWithVersion,
} from "@/lib/documents/update-document";

const documentIdSchema = z.string().min(1).max(64);
const updateSchema = z
  .object({
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(120).optional(),
    content: z
      .object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() })
      .passthrough()
      .optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.content !== undefined,
    "No changes supplied.",
  );

async function findDocument(id: string) {
  return db.document.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      shares: { select: { userId: true, role: true } },
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, userId] = await Promise.all([params, getCurrentUserId()]);
  if (!documentIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }
  const document = await findDocument(id);
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (!canAccessDocument(document, userId)) {
    return NextResponse.json(
      { error: "You do not have access to this document." },
      { status: 403 },
    );
  }
  return NextResponse.json({
    id: document.id,
    name: document.name,
    content: document.content,
    version: document.version,
    ownerId: document.ownerId,
    owner: document.owner,
    updatedAt: document.updatedAt,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, userId] = await Promise.all([params, getCurrentUserId()]);
  if (!documentIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid document data." },
      { status: 400 },
    );
  }
  const content = parsed.data.content;
  if (content && JSON.stringify(content).length > 2_000_000) {
    return NextResponse.json({ error: "Document content is too large." }, { status: 413 });
  }
  try {
    const updated = await updateDocumentWithVersion(prismaDocumentUpdateStore, {
      id,
      userId,
      version: parsed.data.version,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(content !== undefined ? { content } : {}),
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof DocumentUpdateError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.currentVersion ? { currentVersion: error.currentVersion } : {}),
        },
        { status: error.status },
      );
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, userId] = await Promise.all([params, getCurrentUserId()]);
  if (!documentIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }

  const document = await db.document.findUnique({ where: { id }, select: { ownerId: true } });
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (document.ownerId !== userId) {
    return NextResponse.json(
      { error: "Only the owner can delete this document." },
      { status: 403 },
    );
  }

  await db.document.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
