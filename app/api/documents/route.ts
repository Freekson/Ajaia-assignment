import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { EMPTY_DOCUMENT } from "@/lib/constants";

export async function GET() {
  const userId = await getCurrentUserId();
  const documents = await db.document.findMany({
    where: { OR: [{ ownerId: userId }, { shares: { some: { userId } } }] },
    select: {
      id: true,
      name: true,
      version: true,
      ownerId: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(documents);
}

export async function POST() {
  const userId = await getCurrentUserId();
  const document = await db.document.create({ data: { ownerId: userId, content: EMPTY_DOCUMENT } });
  return NextResponse.json(document, { status: 201 });
}
