# Architecture

## Overview

Ajaia Docs is a single Next.js App Router deployment. React Server Components read dashboard/editor data directly through Prisma, while browser mutations use Route Handlers. This keeps credentials and permission checks on the server and avoids a second backend service.

```text
Browser UI (Dashboard + Tiptap)
        │ fetch /api/*
        ▼
Next.js Route Handlers ── permission checks
        │
        ▼
Prisma ORM ────────────── PostgreSQL / Neon
```

## Data model

- `User`: the two seeded demo identities.
- `Document`: title, Tiptap JSON content, owner, monotonic integer version, and timestamps.
- `DocumentShare`: unique document/user join row granting `VIEWER` or `EDITOR` access. Existing shares were migrated to `EDITOR` to preserve prior behavior; newly created shares default to `VIEWER`.

Foreign keys cascade when a parent is removed. Indexes cover owner lists, recipient lookups, and modified-date ordering.

## Identity and authorization

`POST /api/session` validates a database user and writes the selected ID to an HTTP-only, same-site cookie. This is a deliberate demo-auth boundary, not a production authentication system. Every document handler resolves that cookie server-side. Owners have full access, `EDITOR` shares can read and change content, and `VIEWER` shares are read-only. Rename, delete, and share management remain owner-only. Write roles are enforced both before updates and inside the atomic PostgreSQL update filter.

## Persistence and editor flow

Tiptap produces a structured JSON document. The editor waits 800 ms after the last change and feeds the latest snapshot into a serialized queue, so an older request cannot complete after a newer request. Navigation flushes that queue before leaving; failed navigation offers Retry, Stay, or Discard, while `beforeunload` protects refresh and tab close. Viewers receive a non-editable editor and disabled formatting controls, while export remains available.

Each PATCH includes the client's document version. PostgreSQL atomically updates only a row matching both its ID and version, increments the version, and rejects stale writes with `409 Conflict`. Conflict UI preserves the local editor content, pauses autosave, and lets the user copy their text or reload the current server version. PostgreSQL stores editor content as `JSONB`, preserving marks, nodes, headings, and list structure. The browser can serialize the current Tiptap JSON to a Markdown download; this is a client-side export and does not change persisted content.

## API surface

| Method          | Route                       | Purpose                                |
| --------------- | --------------------------- | -------------------------------------- |
| GET/POST        | `/api/documents`            | List accessible documents / create one |
| GET/PATCH/DELETE | `/api/documents/:id`       | Read / rename or save content / delete |
| POST            | `/api/documents/import`     | Validate and import a `.txt` file      |
| GET/POST/DELETE | `/api/documents/:id/shares` | List, set a viewer/editor role, or revoke a share |
| POST            | `/api/session`              | Switch seeded demo identity            |

## Tradeoffs

Server Components reduce client fetching complexity, while Route Handlers provide a testable security boundary for writes. Version-based conflict detection protects the scoped MVP without pretending to provide real-time collaboration. Automatic merging would require a collaboration provider or CRDT and is intentionally deferred.
