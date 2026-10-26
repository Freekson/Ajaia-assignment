"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";

export type DashboardDocument = {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  owner: { id: string; name: string; email: string };
  accessRole?: "VIEWER" | "EDITOR";
};

type Props = {
  mine: DashboardDocument[];
  shared: DashboardDocument[];
  otherUser?: { id: string; name: string };
};

async function readError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "The request could not be completed.";
}

export function Dashboard({ mine, shared, otherUser }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<DashboardDocument | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renamePending, setRenamePending] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [sharingDocumentId, setSharingDocumentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardDocument | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function createDocument() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/documents", { method: "POST" });
      if (response.ok) {
        const document = (await response.json()) as { id: string };
        router.push(`/documents/${document.id}`);
        return;
      }
      setNotice({ kind: "error", text: await readError(response) });
    } catch {
      setNotice({ kind: "error", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/documents/import", { method: "POST", body });
      if (response.ok) {
        const document = (await response.json()) as { id: string };
        router.push(`/documents/${document.id}`);
        return;
      }
      setNotice({ kind: "error", text: await readError(response) });
    } catch {
      setNotice({ kind: "error", text: "Could not reach the server." });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function openRename(document: DashboardDocument) {
    setRenameTarget(document);
    setRenameName(document.name);
    setRenameError(null);
  }

  function closeRename() {
    if (!renamePending) setRenameTarget(null);
  }

  async function renameDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) {
      setRenameError("Document name cannot be empty.");
      return;
    }
    if (name === renameTarget.name) {
      closeRename();
      return;
    }
    setRenamePending(true);
    setRenameError(null);
    try {
      const response = await fetch(`/api/documents/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, version: renameTarget.version }),
      });
      if (!response.ok) setRenameError(await readError(response));
      else {
        setNotice({ kind: "success", text: "Document renamed." });
        setRenameTarget(null);
        router.refresh();
      }
    } catch {
      setRenameError("Could not reach the server.");
    } finally {
      setRenamePending(false);
    }
  }

  async function shareDocument(document: DashboardDocument) {
    if (!otherUser) return;
    setSharingDocumentId(document.id);
    try {
      const response = await fetch(`/api/documents/${document.id}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: otherUser.id }),
      });
      if (!response.ok) setNotice({ kind: "error", text: await readError(response) });
      else
        setNotice({ kind: "success", text: `Shared “${document.name}” with ${otherUser.name}.` });
    } catch {
      setNotice({ kind: "error", text: "Could not reach the server." });
    } finally {
      setSharingDocumentId(null);
    }
  }

  function openDelete(document: DashboardDocument) {
    setDeleteTarget(document);
    setDeleteError(null);
  }

  function closeDelete() {
    if (!deletePending) setDeleteTarget(null);
  }

  async function deleteDocument() {
    if (!deleteTarget) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/documents/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) {
        setDeleteError(await readError(response));
        return;
      }
      setNotice({ kind: "success", text: `Deleted “${deleteTarget.name}”.` });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Could not reach the server.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <section className="mb-12 overflow-hidden rounded-3xl bg-ink px-7 py-9 text-white shadow-card sm:px-10 sm:py-11">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#a8d7bb]">
            Your workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Turn thoughts into shared work.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
            Create a document, shape it with rich text, and invite your teammate when it is ready.
          </p>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button
            onClick={createDocument}
            disabled={busy}
            className="bg-[#8cd3a9] text-ink hover:bg-[#a4dfbc]"
          >
            <FilePlus2 className="h-4 w-4" />
            New document
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <Upload className="h-4 w-4" />
            Import .txt
          </Button>
          <input
            ref={fileInput}
            className="hidden"
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => importFile(event.target.files?.[0])}
          />
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className={`mb-7 rounded-xl border px-4 py-3 text-sm ${notice.kind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {notice.text}
        </div>
      )}

      <DocumentSection
        title="My documents"
        subtitle={`${mine.length} ${mine.length === 1 ? "document" : "documents"}`}
        empty="Create your first document to get started."
      >
        {mine.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            owned
            sharing={sharingDocumentId === document.id}
            deleting={deletePending && deleteTarget?.id === document.id}
            onRename={() => openRename(document)}
            onShare={() => shareDocument(document)}
            onDelete={() => openDelete(document)}
          />
        ))}
      </DocumentSection>

      <DocumentSection
        title="Shared with me"
        subtitle={`${shared.length} ${shared.length === 1 ? "document" : "documents"}`}
        empty="Documents shared with you will appear here."
      >
        {shared.map((document) => (
          <DocumentCard key={document.id} document={document} />
        ))}
      </DocumentSection>

      <Modal
        open={Boolean(renameTarget)}
        title="Rename document"
        description="Choose a clear name so it is easy to find later."
        onClose={closeRename}
      >
        <form className="mt-6" onSubmit={renameDocument}>
          <label htmlFor="rename-document" className="mb-2 block text-sm font-medium text-zinc-700">
            Document name
          </label>
          <Input
            id="rename-document"
            autoFocus
            maxLength={120}
            value={renameName}
            onChange={(event) => {
              setRenameName(event.target.value);
              setRenameError(null);
            }}
            aria-invalid={Boolean(renameError)}
            aria-describedby={renameError ? "rename-error" : undefined}
            className={renameError ? "border-red-300 focus:border-red-500 focus:ring-red-100" : ""}
          />
          <div className="mt-2 flex min-h-5 items-start justify-between gap-3 text-xs">
            {renameError ? (
              <p id="rename-error" role="alert" className="text-red-600">
                {renameError}
              </p>
            ) : (
              <span />
            )}
            <span className="shrink-0 text-zinc-400">{renameName.length}/120</span>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeRename} disabled={renamePending}>
              Cancel
            </Button>
            <Button type="submit" disabled={renamePending || !renameName.trim()}>
              {renamePending ? "Renaming…" : "Save name"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete document?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be permanently deleted for everyone who can access it. This action cannot be undone.`
            : undefined
        }
        onClose={closeDelete}
      >
        <div className="mt-6">
          {deleteError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDelete} disabled={deletePending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void deleteDocument()}
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Delete document"}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}

function DocumentSection({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        </div>
      </div>
      {hasChildren ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-12 text-center text-sm text-zinc-500">
          {empty}
        </div>
      )}
    </section>
  );
}

function DocumentCard({
  document,
  owned = false,
  sharing = false,
  deleting = false,
  onRename,
  onShare,
  onDelete,
}: {
  document: DashboardDocument;
  owned?: boolean;
  sharing?: boolean;
  deleting?: boolean;
  onRename?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/documents/${document.id}`} className="flex min-w-0 flex-1 items-start gap-3">
          <span className="rounded-xl bg-brand-soft p-2.5 text-brand">
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-zinc-900">{document.name}</span>
            <span className="mt-1 block truncate text-xs text-zinc-500">
              Owner: {document.owner.name}
            </span>
            {!owned && document.accessRole && (
              <span className="mt-2 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-dark">
                {document.accessRole === "EDITOR" ? "Can edit" : "View only"}
              </span>
            )}
          </span>
        </Link>
        {owned && (
          <div className="flex gap-1">
            <Button
              aria-label="Rename document"
              title="Rename"
              size="icon"
              variant="ghost"
              onClick={onRename}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Button
              aria-label="Share document"
              title="Share"
              size="icon"
              variant="ghost"
              disabled={sharing}
              onClick={onShare}
            >
              <Share2 className={`h-4 w-4 ${sharing ? "animate-pulse" : ""}`} />
            </Button>
            <Button
              aria-label="Delete document"
              title="Delete"
              size="icon"
              variant="ghost"
              disabled={deleting}
              onClick={onDelete}
              className="hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className={`h-4 w-4 ${deleting ? "animate-pulse" : ""}`} />
            </Button>
          </div>
        )}
      </div>
      <div className="mt-6 flex items-center gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
        <CalendarDays className="h-3.5 w-3.5" />
        Edited {formatDate(document.updatedAt)}
      </div>
    </article>
  );
}
