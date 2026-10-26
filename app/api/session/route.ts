import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { USER_COOKIE } from "@/lib/constants";

const schema = z.object({ userId: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid user." }, { status: 400 });
  }
  const user = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
