"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowLeft,
  Bold,
  Clipboard,
  Check,
  Download,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  RefreshCw,
  Share2,
  Underline as UnderlineIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { UserSwitcher } from "@/components/user-switcher";
import { SaveQueueFailure, SerializedSaveQueue, type SaveQueueStatus } from "@/lib/save-queue";
import { markdownFilename, tiptapToMarkdown } from "@/lib/export-markdown";

type User = { id: string; name: string; email: string };
type ShareRole = "VIEWER" | "EDITOR";
type ShareAccess = { userId: string; role: ShareRole };
type Props = {
  document: {
    id: string;
    name: string;
    content: JSONContent;
    version: number;
    owner: User;
    ownerId: string;
  };
  currentUser: User;
  users: User[];
  initialShares: ShareAccess[];
  canEdit: boolean;
};
type DocumentPatch = { name?: string; content?: JSONContent };
type PendingNavigation = (() => Promise<boolean>) | null;

export function DocumentEditor({ document, currentUser, users, initialShares, canEdit }: Props) {
  const router = useRouter();
  const [name, setName] = useState(document.name);
  const [saveState, setSaveState] = useState<SaveQueueStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shares, setShares] = useState(initialShares);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [sharingUserId, setSharingUserId] = useState<string | null>(null);
  const [navigationDialogOpen, setNavigationDialogOpen] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "success" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNavigation = useRef<PendingNavigation>(null);
  const isOwner = document.ownerId === currentUser.id;

  const [{ queue, setServerVersion }] = useState(() => {
    let serverVersion = document.version;
    return {
      queue: new SerializedSaveQueue<DocumentPatch>(
        async (patch) => {
          const normalizedPatch =
            patch.name !== undefined ? { ...patch, name: patch.name.trim() } : patch;
          if (normalizedPatch.name !== undefined && !normalizedPatch.name) {
            throw new SaveQueueFailure("error", "Document name cannot be empty.");
          }
          let response: Response;
          try {
            response = await fetch(`/api/documents/${document.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...normalizedPatch, version: serverVersion }),
            });
          } catch {
            throw new SaveQueueFailure(
              "error",
              "Could not reach the server. Check your connection and retry.",
            );
          }
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            code?: string;
            version?: number;
          } | null;
          if (!response.ok) {
            throw new SaveQueueFailure(
              response.status === 409 || body?.code === "VERSION_CONFLICT" ? "conflict" : "error",
              body?.error ?? "Your changes could not be saved.",
            );
          }
          if (typeof body?.version === "number") {
            serverVersion = body.version;
          }
        },
        (status, message) => {
          setSaveState(status);
          setSaveError(message ?? null);
          if (status === "conflict") setConflictDialogOpen(true);
        },
      ),
      setServerVersion(version: number) {
        serverVersion = version;
      },
    };
  });

  function scheduleSave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void queue.flush();
    }, 800);
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: document.content,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap" } },
    onUpdate: ({ editor: currentEditor }) => {
      if (!canEdit) {
        return;
      }
      queue.enqueue({ content: currentEditor.getJSON() });
      scheduleSave();
    },
  });

  useEffect(() => {
    editor?.setEditable(canEdit);
    if (!canEdit) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      queue.discard();
    }
  }, [canEdit, editor, queue]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!queue.hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [queue]);

  function updateName(value: string) {
    setName(value);
    queue.enqueue({ name: value });
    scheduleSave();
  }

  async function flushNow() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await queue.flush();
  }

  async function requestNavigation(action: () => Promise<boolean>) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!queue.hasUnsavedChanges() || (await queue.flush())) {
      await action();
      return;
    }
    pendingNavigation.current = action;
    setConflictDialogOpen(false);
    setNavigationDialogOpen(true);
  }

  async function retryNavigation() {
    if (!(await queue.retry())) return;
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    setNavigationDialogOpen(false);
    if (action) await action();
  }

  async function discardAndNavigate() {
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    queue.discard();
    setNavigationDialogOpen(false);
    if (action) await action();
  }

  async function reloadLatest() {
    const response = await fetch(`/api/documents/${document.id}`);
    if (!response.ok) {
      setSaveError("Could not load the latest version.");
      return;
    }
    const latest = (await response.json()) as {
      name: string;
      content: JSONContent;
      version: number;
    };
    editor?.commands.setContent(latest.content, { emitUpdate: false });
    setName(latest.name);
    setServerVersion(latest.version);
    queue.discard();
    setConflictDialogOpen(false);
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    if (action) await action();
  }

  function keepEditing() {
    pendingNavigation.current = null;
    setNavigationDialogOpen(false);
    setConflictDialogOpen(false);
  }

  async function copyLocalContent() {
    try {
      await navigator.clipboard.writeText(editor?.getText() ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setSaveError("Clipboard access was blocked by the browser.");
    }
  }

  function exportMarkdown() {
    if (!editor) {
      return;
    }

    try {
      const blob = new Blob([tiptapToMarkdown(editor.getJSON())], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = markdownFilename(name);
      link.style.display = "none";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setExportState("success");
      window.setTimeout(() => setExportState("idle"), 1800);
    } catch {
      setExportState("error");
    }
  }

  async function setShareRole(userId: string, role: ShareRole) {
    setShareError(null);
    setShareNotice(null);
    setSharingUserId(userId);
    try {
      const response = await fetch(`/api/documents/${document.id}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setShareError(body?.error ?? "Could not update sharing.");
      } else {
        const share = (await response.json()) as ShareAccess;
        const recipient = users.find((user) => user.id === userId);
        setShares((current) => [...current.filter((item) => item.userId !== userId), share]);
        setShareNotice(`${recipient?.name ?? "User"} now has ${role.toLowerCase()} access.`);
        router.refresh();
      }
    } catch {
      setShareError("Could not reach the server.");
    } finally {
      setSharingUserId(null);
    }
  }

  async function removeShare(userId: string) {
    setShareError(null);
    setShareNotice(null);
    setSharingUserId(userId);
    try {
      const response = await fetch(`/api/documents/${document.id}/shares`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setShareError(body?.error ?? "Could not remove access.");
      } else {
        setShares((current) => current.filter((share) => share.userId !== userId));
        const recipient = users.find((user) => user.id === userId);
        setShareNotice(`Removed access for ${recipient?.name ?? "user"}.`);
        router.refresh();
      }
    } catch {
      setShareError("Could not reach the server.");
    } finally {
      setSharingUserId(null);
    }
  }

  const statusText =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Save failed — your changes are still in this tab"
        : saveState === "conflict"
          ? "Save paused — a newer version exists"
          : isOwner
            ? "Saved · Owned by you"
            : `${canEdit ? "Can edit" : "View only"} · Owned by ${document.owner.name}`;

  return (
    <div className="min-h-screen bg-[#eef0ec]">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-16 items-center gap-2 px-3 sm:px-5">
          <button
            type="button"
            onClick={() =>
              void requestNavigation(async () => {
                router.push("/");
                return true;
              })
            }
            aria-label="Back to dashboard"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="hidden h-8 w-px bg-zinc-200 sm:block" />
          <div className="min-w-0 flex-1">
            <Input
              aria-label="Document title"
              className="h-8 max-w-md border-transparent px-2 text-base font-semibold hover:border-zinc-200 focus:border-brand"
              value={name}
              readOnly={!isOwner}
              maxLength={120}
              onChange={(event) => updateName(event.target.value)}
              onBlur={() => void flushNow()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <p
              className={`px-2 text-[11px] ${saveState === "error" ? "text-red-600" : saveState === "conflict" ? "text-amber-700" : "text-zinc-500"}`}
              aria-live="polite"
            >
              {statusText}
            </p>
          </div>
          {saveState === "error" && (
            <Button size="sm" variant="outline" onClick={() => void queue.retry()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!editor}
            onClick={exportMarkdown}
            aria-label="Export document to Markdown"
            title={exportState === "error" ? "Export failed" : "Export to Markdown"}
          >
            {exportState === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden md:inline">
              {exportState === "success"
                ? "Exported"
                : exportState === "error"
                  ? "Export failed"
                  : "Export .md"}
            </span>
          </Button>
          {isOwner && (
            <Button variant="secondary" size="sm" onClick={() => setShareOpen((open) => !open)}>
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}
          <div className="sm:hidden">
            <UserSwitcher
              compact
              users={users}
              currentUserId={currentUser.id}
              requestNavigation={(action) => void requestNavigation(action)}
            />
          </div>
          <div className="hidden sm:block">
            <UserSwitcher
              users={users}
              currentUserId={currentUser.id}
              requestNavigation={(action) => void requestNavigation(action)}
            />
          </div>
        </div>
        <Toolbar editor={editor} editable={canEdit} />
        {shareOpen && isOwner && (
          <div className="absolute right-4 top-16 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-card">
            <h2 className="font-semibold">Share document</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Choose whether each person can only view or can also edit.
            </p>
            <div className="mt-4 space-y-2">
              {users
                .filter((user) => user.id !== currentUser.id)
                .map((user) => {
                  const access = shares.find((share) => share.userId === user.id);
                  const pending = sharingUserId === user.id;
                  return (
                    <div key={user.id} className="rounded-xl bg-zinc-50 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-zinc-500">{user.email}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div
                          role="group"
                          aria-label={`Access level for ${user.name}`}
                          className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5"
                        >
                          {(["VIEWER", "EDITOR"] as const).map((role) => (
                            <button
                              key={role}
                              type="button"
                              aria-pressed={access?.role === role}
                              disabled={sharingUserId !== null}
                              onClick={() => void setShareRole(user.id, role)}
                              className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${access?.role === role ? "bg-brand text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                            >
                              {role === "VIEWER" ? "Viewer" : "Editor"}
                            </button>
                          ))}
                        </div>
                        {access && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={sharingUserId !== null}
                            onClick={() => void removeShare(user.id)}
                          >
                            {pending ? "Updating…" : "Remove"}
                          </Button>
                        )}
                        {!access && pending && (
                          <span className="text-xs text-zinc-500">Sharing…</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            {shareError && <p className="mt-3 text-xs text-red-600">{shareError}</p>}
            {shareNotice && <p role="status" className="mt-3 text-xs text-emerald-700">{shareNotice}</p>}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[900px] px-3 py-6 sm:px-8 sm:py-10">
        {!canEdit && (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <strong>View-only access.</strong> You can read and export this document, but only its
            owner or an editor can change it.
          </div>
        )}
        {saveState === "conflict" && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="min-w-0 flex-1">
              <strong>Autosave paused.</strong> This document was modified in another session.
            </span>
            <Button size="sm" variant="outline" onClick={() => void copyLocalContent()}>
              <Clipboard className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy my text"}
            </Button>
            <Button size="sm" onClick={() => setConflictDialogOpen(true)}>
              Resolve
            </Button>
          </div>
        )}
        <div className="min-h-[920px] rounded-sm border border-zinc-200 bg-white px-6 py-10 shadow-[0_2px_12px_rgba(0,0,0,0.08)] sm:px-16 sm:py-14">
          <EditorContent editor={editor} />
        </div>
      </main>

      <Modal
        open={navigationDialogOpen}
        title="Your changes are not saved"
        description={
          saveError ?? "We could not save your latest changes. Choose what you want to do."
        }
        onClose={() => {
          setNavigationDialogOpen(false);
          pendingNavigation.current = null;
        }}
      >
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={keepEditing}>
            Stay
          </Button>
          <Button variant="danger" onClick={() => void discardAndNavigate()}>
            Discard changes
          </Button>
          {saveState === "conflict" ? (
            <Button
              onClick={() => {
                setNavigationDialogOpen(false);
                setConflictDialogOpen(true);
              }}
            >
              Resolve conflict
            </Button>
          ) : (
            <Button onClick={() => void retryNavigation()}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </Modal>

      <Modal
        open={conflictDialogOpen}
        title="This document was modified in another session"
        description="Your local changes are still in this editor. Reloading will replace them with the latest server version."
        onClose={keepEditing}
      >
        <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
          Copy your local text before reloading if you want to keep it outside the editor.
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={keepEditing}>
            Keep editing
          </Button>
          <Button variant="outline" onClick={() => void copyLocalContent()}>
            <Clipboard className="h-4 w-4" />
            {copied ? "Copied" : "Copy my text"}
          </Button>
          <Button onClick={() => void reloadLatest()}>Reload latest version</Button>
        </div>
      </Modal>
    </div>
  );
}

function Toolbar({ editor, editable }: { editor: Editor | null; editable: boolean }) {
  if (!editor) return <div className="h-12 border-t border-zinc-100" />;
  const items = [
    {
      label: "Bold",
      icon: Bold,
      active: editor.isActive("bold"),
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: editor.isActive("italic"),
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      icon: UnderlineIcon,
      active: editor.isActive("underline"),
      action: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Heading 1",
      icon: Heading1,
      active: editor.isActive("heading", { level: 1 }),
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      icon: Heading2,
      active: editor.isActive("heading", { level: 2 }),
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      icon: Heading3,
      active: editor.isActive("heading", { level: 3 }),
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bullet list",
      icon: List,
      active: editor.isActive("bulletList"),
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: editor.isActive("orderedList"),
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t border-zinc-100 px-3 py-2 sm:px-16">
      {items.map(({ label, icon: Icon, active, action }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={active}
          disabled={!editable}
          onClick={action}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-brand-soft text-brand-dark" : "text-zinc-600 hover:bg-zinc-100"}`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
