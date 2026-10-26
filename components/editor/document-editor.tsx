"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, Bold, Clipboard, Heading1, Heading2, Heading3, Italic, List, ListOrdered, RefreshCw, Share2, Underline as UnderlineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { UserSwitcher } from "@/components/user-switcher";
import { SaveQueueFailure, SerializedSaveQueue, type SaveQueueStatus } from "@/lib/save-queue";

type User = { id: string; name: string; email: string };
type Props = {
  document: { id: string; name: string; content: JSONContent; version: number; owner: User; ownerId: string };
  currentUser: User;
  users: User[];
  sharedUserIds: string[];
};
type DocumentPatch = { name?: string; content?: JSONContent };
type PendingNavigation = (() => Promise<boolean>) | null;

export function DocumentEditor({ document, currentUser, users, sharedUserIds }: Props) {
  const router = useRouter();
  const [name, setName] = useState(document.name);
  const [saveState, setSaveState] = useState<SaveQueueStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shares, setShares] = useState(sharedUserIds);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharingUserId, setSharingUserId] = useState<string | null>(null);
  const [navigationDialogOpen, setNavigationDialogOpen] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(document.version);
  const pendingNavigation = useRef<PendingNavigation>(null);
  const queueRef = useRef<SerializedSaveQueue<DocumentPatch> | null>(null);
  const isOwner = document.ownerId === currentUser.id;

  if (!queueRef.current) {
    queueRef.current = new SerializedSaveQueue<DocumentPatch>(
      async (patch) => {
        const normalizedPatch = patch.name !== undefined ? { ...patch, name: patch.name.trim() } : patch;
        if (normalizedPatch.name !== undefined && !normalizedPatch.name) {
          throw new SaveQueueFailure("error", "Document name cannot be empty.");
        }
        let response: Response;
        try {
          response = await fetch(`/api/documents/${document.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...normalizedPatch, version: versionRef.current }),
          });
        } catch {
          throw new SaveQueueFailure("error", "Could not reach the server. Check your connection and retry.");
        }
        const body = (await response.json().catch(() => null)) as { error?: string; code?: string; version?: number } | null;
        if (!response.ok) {
          throw new SaveQueueFailure(
            response.status === 409 || body?.code === "VERSION_CONFLICT" ? "conflict" : "error",
            body?.error ?? "Your changes could not be saved.",
          );
        }
        if (typeof body?.version === "number") versionRef.current = body.version;
      },
      (status, message) => {
        setSaveState(status);
        setSaveError(message ?? null);
        if (status === "conflict") setConflictDialogOpen(true);
      },
    );
  }
  const queue = queueRef.current;

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
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap" } },
    onUpdate: ({ editor: currentEditor }) => {
      queue.enqueue({ content: currentEditor.getJSON() });
      scheduleSave();
    },
  });

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
    if (!queue.hasUnsavedChanges() || await queue.flush()) {
      await action();
      return;
    }
    pendingNavigation.current = action;
    setConflictDialogOpen(false);
    setNavigationDialogOpen(true);
  }

  async function retryNavigation() {
    if (!await queue.retry()) return;
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
    const latest = await response.json() as { name: string; content: JSONContent; version: number };
    editor?.commands.setContent(latest.content, { emitUpdate: false });
    setName(latest.name);
    versionRef.current = latest.version;
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

  async function toggleShare(userId: string) {
    setShareError(null);
    setSharingUserId(userId);
    const isShared = shares.includes(userId);
    try {
      const response = await fetch(`/api/documents/${document.id}/shares`, {
        method: isShared ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setShareError(body?.error ?? "Could not update sharing.");
      } else {
        setShares((current) => isShared ? current.filter((id) => id !== userId) : [...current, userId]);
      }
    } catch {
      setShareError("Could not reach the server.");
    } finally {
      setSharingUserId(null);
    }
  }

  const statusText = saveState === "saving"
    ? "Saving…"
    : saveState === "error"
      ? "Save failed — your changes are still in this tab"
      : saveState === "conflict"
        ? "Save paused — a newer version exists"
        : `Saved · ${isOwner ? "Owned by you" : `Owned by ${document.owner.name}`}`;

  return (
    <div className="min-h-screen bg-[#eef0ec]">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-16 items-center gap-2 px-3 sm:px-5">
          <button type="button" onClick={() => void requestNavigation(async () => { router.push("/"); return true; })} aria-label="Back to dashboard" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100"><ArrowLeft className="h-5 w-5" /></button>
          <span className="hidden h-8 w-px bg-zinc-200 sm:block" />
          <div className="min-w-0 flex-1">
            <Input aria-label="Document title" className="h-8 max-w-md border-transparent px-2 text-base font-semibold hover:border-zinc-200 focus:border-brand" value={name} readOnly={!isOwner} maxLength={120} onChange={(event) => updateName(event.target.value)} onBlur={() => void flushNow()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
            <p className={`px-2 text-[11px] ${saveState === "error" ? "text-red-600" : saveState === "conflict" ? "text-amber-700" : "text-zinc-500"}`} aria-live="polite">{statusText}</p>
          </div>
          {saveState === "error" && <Button size="sm" variant="outline" onClick={() => void queue.retry()}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>}
          {isOwner && <Button variant="secondary" size="sm" onClick={() => setShareOpen((open) => !open)}><Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span></Button>}
          <div className="sm:hidden"><UserSwitcher compact users={users} currentUserId={currentUser.id} requestNavigation={(action) => void requestNavigation(action)} /></div>
          <div className="hidden sm:block"><UserSwitcher users={users} currentUserId={currentUser.id} requestNavigation={(action) => void requestNavigation(action)} /></div>
        </div>
        <Toolbar editor={editor} />
        {shareOpen && isOwner && (
          <div className="absolute right-4 top-16 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-card">
            <h2 className="font-semibold">Share document</h2>
            <p className="mt-1 text-xs text-zinc-500">People with access can edit the document.</p>
            <div className="mt-4 space-y-2">
              {users.filter((user) => user.id !== currentUser.id).map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-zinc-500">{user.email}</p></div>
                  <Button disabled={sharingUserId !== null} size="sm" variant={shares.includes(user.id) ? "outline" : "default"} onClick={() => void toggleShare(user.id)}>{sharingUserId === user.id ? "Updating…" : shares.includes(user.id) ? "Remove" : "Share"}</Button>
                </div>
              ))}
            </div>
            {shareError && <p className="mt-3 text-xs text-red-600">{shareError}</p>}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[900px] px-3 py-6 sm:px-8 sm:py-10">
        {saveState === "conflict" && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="min-w-0 flex-1"><strong>Autosave paused.</strong> This document was modified in another session.</span>
            <Button size="sm" variant="outline" onClick={() => void copyLocalContent()}><Clipboard className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy my text"}</Button>
            <Button size="sm" onClick={() => setConflictDialogOpen(true)}>Resolve</Button>
          </div>
        )}
        <div className="min-h-[920px] rounded-sm border border-zinc-200 bg-white px-6 py-10 shadow-[0_2px_12px_rgba(0,0,0,0.08)] sm:px-16 sm:py-14"><EditorContent editor={editor} /></div>
      </main>

      <Modal open={navigationDialogOpen} title="Your changes are not saved" description={saveError ?? "We could not save your latest changes. Choose what you want to do."} onClose={() => { setNavigationDialogOpen(false); pendingNavigation.current = null; }}>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={keepEditing}>Stay</Button>
          <Button variant="danger" onClick={() => void discardAndNavigate()}>Discard changes</Button>
          {saveState === "conflict"
            ? <Button onClick={() => { setNavigationDialogOpen(false); setConflictDialogOpen(true); }}>Resolve conflict</Button>
            : <Button onClick={() => void retryNavigation()}><RefreshCw className="h-4 w-4" />Retry</Button>}
        </div>
      </Modal>

      <Modal open={conflictDialogOpen} title="This document was modified in another session" description="Your local changes are still in this editor. Reloading will replace them with the latest server version." onClose={keepEditing}>
        <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">Copy your local text before reloading if you want to keep it outside the editor.</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={keepEditing}>Keep editing</Button>
          <Button variant="outline" onClick={() => void copyLocalContent()}><Clipboard className="h-4 w-4" />{copied ? "Copied" : "Copy my text"}</Button>
          <Button onClick={() => void reloadLatest()}>Reload latest version</Button>
        </div>
      </Modal>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div className="h-12 border-t border-zinc-100" />;
  const items = [
    { label: "Bold", icon: Bold, active: editor.isActive("bold"), action: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, active: editor.isActive("italic"), action: () => editor.chain().focus().toggleItalic().run() },
    { label: "Underline", icon: UnderlineIcon, active: editor.isActive("underline"), action: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Heading 1", icon: Heading1, active: editor.isActive("heading", { level: 1 }), action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "Heading 2", icon: Heading2, active: editor.isActive("heading", { level: 2 }), action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Heading 3", icon: Heading3, active: editor.isActive("heading", { level: 3 }), action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Bullet list", icon: List, active: editor.isActive("bulletList"), action: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: editor.isActive("orderedList"), action: () => editor.chain().focus().toggleOrderedList().run() },
  ];
  return <div className="flex items-center gap-1 overflow-x-auto border-t border-zinc-100 px-3 py-2 sm:px-16">{items.map(({ label, icon: Icon, active, action }) => <button key={label} type="button" title={label} aria-label={label} aria-pressed={active} onClick={action} className={`grid h-8 w-8 shrink-0 place-items-center rounded-md transition ${active ? "bg-brand-soft text-brand-dark" : "text-zinc-600 hover:bg-zinc-100"}`}><Icon className="h-4 w-4" /></button>)}</div>;
}
