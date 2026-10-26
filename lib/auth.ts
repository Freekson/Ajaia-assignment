import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID, DEMO_USERS, USER_COOKIE } from "@/lib/constants";

export async function getCurrentUserId() {
  const store = await cookies();
  const requested = store.get(USER_COOKIE)?.value;
  return DEMO_USERS.some((user) => user.id === requested) ? requested! : DEFAULT_USER_ID;
}

export async function getCurrentUser() {
  const id = await getCurrentUserId();
  return db.user.findUniqueOrThrow({ where: { id } });
}
