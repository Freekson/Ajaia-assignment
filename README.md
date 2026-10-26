# Ajaia Docs

A lightweight full-stack document editor built with Next.js, TypeScript, Tailwind CSS, shadcn/ui conventions, Tiptap, Prisma, and PostgreSQL. The MVP supports rich-text editing, debounced autosave, `.txt` import, two demo users, ownership, and server-enforced sharing.

## Features

- Create, rename, edit, save, and reopen documents
- Bold, italic, underline, H1–H3, bulleted and numbered lists
- Structured Tiptap JSON persisted in PostgreSQL
- Import `.txt` files up to 1 MB with validation feedback
- Switch between seeded Alice and Bob demo accounts
- Share and revoke document access; shared users can edit content
- Separate “My documents” and “Shared with me” sections
- Permission checks in every document and sharing route
- Serialized autosave with retry, save-before-navigation, and unload protection
- Optimistic concurrency control that rejects stale document versions with `409 Conflict`
- Responsive dashboard, save status, loading, error, and empty states

## Local setup

Prerequisites: Node.js 20+, npm, and Docker Desktop. A remote PostgreSQL database such as Neon can also be used.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the included local PostgreSQL database:

   ```bash
   docker compose up -d
   ```

   The checked-in `.env.example` documents the variables. For local development, create `.env` with the connection strings from `docker-compose.yml`. With Neon, use its pooled URL for `DATABASE_URL` and direct URL for `DIRECT_URL`.

3. Apply the migration and seed the two demo users:

   ```bash
   npm run db:deploy
   npm run db:seed
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

To stop the local database without deleting its data, run `docker compose stop`. To start it again, run `docker compose start`.

### Demo identities

No passwords are required. Use the workspace switcher to move between seeded users:

- Alice Morgan (`alice@ajaia.demo`)
- Bob Chen (`bob@ajaia.demo`)

This switcher is intentionally demo authentication and must not be treated as a production identity system.

## Validation

```bash
npm test
npm run test:integration
npm run build
```

`npm test` runs isolated unit tests without Docker. `npm run test:integration` starts the separate `postgres-test` Compose profile on port `54330`, applies migrations to `ajaia_docs_test`, verifies concurrent OCC writes, and cleans up its test records. It refuses to run against a URL that does not contain `ajaia_docs_test`.

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel.
2. Add `DATABASE_URL` and `DIRECT_URL` in Vercel project settings.
3. Set the build command to `npm run db:deploy && npm run build`.
4. Deploy, then seed production once from a trusted terminal with the production environment loaded: `npm run db:seed`.
5. Paste the public URL into `SUBMISSION.md` and record the walkthrough URL in `video-link.txt`.

## Demo flow

Start as Alice, create or import a document, apply formatting, wait for “Saved,” and share it with Bob. Return to the dashboard, switch to Bob, open the document under “Shared with me,” edit it, and refresh to verify persistence. Switch back to Alice to revoke access.

## Known limitations

- Demo identity is selected with an HTTP-only cookie; it is intentionally not production authentication.
- Sharing grants edit access, not granular view/edit roles.
- Autosave is serialized within a tab, and cross-session stale writes are rejected. Real-time presence, CRDT conflict resolution, comments, history, and exports are out of scope.
- Concurrent writes use document versions rather than automatic merging. When a conflict occurs, local content remains in the editor and autosave stays paused until the user reloads the latest version; copying the draft exports plain text rather than Tiptap JSON.
- `.txt` import preserves lines as paragraphs but does not infer formatting.
- The MVP has no document deletion to reduce accidental data loss.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [AI_WORKFLOW.md](./AI_WORKFLOW.md), and [SUBMISSION.md](./SUBMISSION.md) for implementation and handoff details.

Use [REVIEW_CHECKLIST.md](./REVIEW_CHECKLIST.md) for the exact local and production smoke-test flow.
