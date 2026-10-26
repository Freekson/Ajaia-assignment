import { Dashboard, type DashboardDocument } from "@/components/dashboard";
import { UserSwitcher } from "@/components/user-switcher";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [currentUser, users] = await Promise.all([
    getCurrentUser(),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  const documents = await db.document.findMany({
    where: { OR: [{ ownerId: currentUser.id }, { shares: { some: { userId: currentUser.id } } }] },
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
  const serialize = (document: (typeof documents)[number]): DashboardDocument => ({ ...document, updatedAt: document.updatedAt.toISOString() });
  const mine = documents.filter((document) => document.ownerId === currentUser.id).map(serialize);
  const shared = documents.filter((document) => document.ownerId !== currentUser.id).map(serialize);
  const otherUser = users.find((user) => user.id !== currentUser.id);

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-bold text-white">A</span><span className="font-semibold tracking-tight">Ajaia Docs</span></div>
          <UserSwitcher users={users} currentUserId={currentUser.id} />
        </div>
      </header>
      <Dashboard mine={mine} shared={shared} otherUser={otherUser} />
    </div>
  );
}
