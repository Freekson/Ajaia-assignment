import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { textToTiptapDocument, validateTextFile } from "@/lib/import-text";

export async function POST(request: Request) {
  const data = await request.formData().catch(() => null);
  const file = data?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a .txt file to import." }, { status: 400 });
  }
  const validationError = validateTextFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const text = await file.text();
  const userId = await getCurrentUserId();
  const name =
    file.name
      .replace(/\.txt$/i, "")
      .trim()
      .slice(0, 120) || "Imported document";
  const document = await db.document.create({
    data: { ownerId: userId, name, content: textToTiptapDocument(text) },
  });
  return NextResponse.json(document, { status: 201 });
}
