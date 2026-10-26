# Submission

## Links

- Public application: https://ajaia-assignment-eta.vercel.app/
- Source repository: https://github.com/Freekson/Ajaia-assignment
- Walkthrough video: see `video-link.txt`

## Included

- Complete Next.js/TypeScript source code
- Prisma PostgreSQL schema and two migrations
- Docker Compose development and isolated test databases
- Unit and PostgreSQL OCC integration tests
- Local setup and deployment instructions in `README.md`
- Architecture decisions in `ARCHITECTURE.md`
- Detailed AI workflow and verification notes in `AI_WORKFLOW.md`
- Local and production smoke steps in `REVIEW_CHECKLIST.md`
- Walkthrough URL placeholder in `video-link.txt`

## Acceptance checklist

- [x] Create, rename, edit, save, reopen, and delete owned documents
- [x] Preserve rich-text formatting as structured JSON
- [x] Import validated `.txt` files up to 1 MB
- [x] Switch between two seeded demo users
- [x] Share documents and show them under “Shared with me”
- [x] Assign viewer or editor roles and enforce them server-side
- [x] Enforce read/write/share permissions server-side
- [x] Persist documents and shares in PostgreSQL through Prisma
- [x] Include meaningful automated tests
- [x] Serialize autosave and preserve failed local changes for retry
- [x] Reject stale concurrent writes using atomic PostgreSQL OCC
- [x] Flush unsaved changes before in-app navigation
- [x] Include reproducible setup and architecture notes
- [x] Add the live Vercel URL after deployment
- [ ] Record and add the 3–5 minute walkthrough video
- [x] Run the production smoke checklist after a Vercel URL exists

## Current submission status

The application is deployed and the production API smoke test passes. Source code, migrations, automated tests, documentation, and the public application URL are ready. Google Drive packaging, screenshots, and the walkthrough video remain pending before submission.

## Production verification

Verified against the public Vercel deployment on October 26, 2026:

- document creation and formatted content save
- optimistic concurrency conflict response (`409`)
- sharing with the second demo user and editing as that user
- access revocation and subsequent forbidden access (`403`)
- valid `.txt` import and reopening the imported document

## Optional enhancement

- Export the current editor content to Markdown, including headings, emphasis, underline, and lists
- Role-based sharing with owner, editor, and viewer permission levels

## Suggested 3–5 minute walkthrough

1. Show Alice’s empty/dashboard state and create a document.
2. Rename it, enter text, and demonstrate headings, marks, and lists.
3. Wait for the visible saved state, refresh, and confirm formatting persists.
4. Import a `.txt` file and briefly demonstrate invalid-file feedback.
5. Share a document with Bob, switch users, and open it under “Shared with me.”
6. Edit as Bob, then mention the server-side authorization boundary, tests, and known limitations.

## Deferred by scope

Production authentication, real-time simultaneous editing/CRDT, comments, suggestions, version history, advanced roles, complex conversion, and export are intentionally not included.
