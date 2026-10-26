import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

const idSchema = z.string().min(1).max(64);
const shareSchema = z.object({
  userId: idSchema,
  role: z.enum(["VIEWER", "EDITOR"]).default("VIEWER"),
});
const revokeSchema = z.object({ userId: idSchema });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, userId] = await Promise.all([params, getCurrentUserId()]);
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }
  const document = await db.document.findUnique({ where: { id }, select: { ownerId: true } });
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (document.ownerId !== userId) {
    return NextResponse.json({ error: "Only the owner can manage sharing." }, { status: 403 });
  }
  const shares = await db.documentShare.findMany({
    where: { documentId: id },
    select: {
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(shares);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, currentUserId] = await Promise.all([params, getCurrentUserId()]);
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }
  const parsed = shareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid user." }, { status: 400 });
  }
  const document = await db.document.findUnique({ where: { id }, select: { ownerId: true } });
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (document.ownerId !== currentUserId) {
    return NextResponse.json({ error: "Only the owner can share this document." }, { status: 403 });
  }
  if (parsed.data.userId === currentUserId) {
    return NextResponse.json({ error: "The owner already has access." }, { status: 400 });
  }
  const recipient = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!recipient) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const share = await db.documentShare.upsert({
    where: { documentId_userId: { documentId: id, userId: recipient.id } },
    create: { documentId: id, userId: recipient.id, role: parsed.data.role },
    update: { role: parsed.data.role },
  });
  return NextResponse.json(share, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, currentUserId] = await Promise.all([params, getCurrentUserId()]);
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }
  const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid user." }, { status: 400 });
  }
  const document = await db.document.findUnique({ where: { id }, select: { ownerId: true } });
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (document.ownerId !== currentUserId) {
    return NextResponse.json({ error: "Only the owner can manage sharing." }, { status: 403 });
  }
  const deleted = await db.documentShare.deleteMany({
    where: { documentId: id, userId: parsed.data.userId },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Share not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
