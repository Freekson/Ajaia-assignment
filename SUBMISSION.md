# Submission

## Links

- Public application: `ADD_VERCEL_URL`
- Source repository: `ADD_REPOSITORY_URL`
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

- [x] Create, rename, edit, save, and reopen documents
- [x] Preserve rich-text formatting as structured JSON
- [x] Import validated `.txt` files up to 1 MB
- [x] Switch between two seeded demo users
- [x] Share documents and show them under “Shared with me”
- [x] Enforce read/write/share permissions server-side
- [x] Persist documents and shares in PostgreSQL through Prisma
- [x] Include meaningful automated tests
- [x] Serialize autosave and preserve failed local changes for retry
- [x] Reject stale concurrent writes using atomic PostgreSQL OCC
- [x] Flush unsaved changes before in-app navigation
- [x] Include reproducible setup and architecture notes
- [ ] Add the live Vercel URL after deployment
- [ ] Record and add the 3–5 minute walkthrough video
- [ ] Run the production smoke checklist after a Vercel URL exists

## Current submission status

The application, migrations, local database, tests, and production build are complete. Deployment, repository URL, Google Drive packaging, screenshots, and the walkthrough video remain pending and must be completed before submission.

## Suggested 3–5 minute walkthrough

1. Show Alice’s empty/dashboard state and create a document.
2. Rename it, enter text, and demonstrate headings, marks, and lists.
3. Wait for the visible saved state, refresh, and confirm formatting persists.
4. Import a `.txt` file and briefly demonstrate invalid-file feedback.
5. Share a document with Bob, switch users, and open it under “Shared with me.”
6. Edit as Bob, then mention the server-side authorization boundary, tests, and known limitations.

## Deferred by scope

Production authentication, real-time simultaneous editing/CRDT, comments, suggestions, version history, advanced roles, complex conversion, and export are intentionally not included.
