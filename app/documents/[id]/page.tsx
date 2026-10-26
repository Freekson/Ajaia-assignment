import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { DocumentEditor } from "@/components/editor/document-editor";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDocument } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, currentUser, users] = await Promise.all([
    params,
    getCurrentUser(),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  const document = await db.document.findUnique({
    where: { id },
    include: { owner: { select: { id: true, name: true, email: true } }, shares: { select: { userId: true } } },
  });

  if (!document || !canAccessDocument(document, currentUser.id)) {
    return <main className="grid min-h-screen place-items-center px-6"><div className="max-w-md text-center"><p className="text-sm font-semibold uppercase tracking-widest text-brand">Access denied</p><h1 className="mt-3 text-3xl font-semibold">This document isn’t available.</h1><p className="mt-3 text-zinc-600">It may not exist, or its owner has not shared it with the selected user.</p><Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white">Back to dashboard</Link></div></main>;
  }

  return <DocumentEditor document={{ id: document.id, name: document.name, content: document.content as JSONContent, version: document.version, owner: document.owner, ownerId: document.ownerId }} currentUser={currentUser} users={users} sharedUserIds={document.shares.map((share) => share.userId)} />;
}
