# AI Workflow

## Tools and role

I used OpenAI Codex as a coding and review partner. AI accelerated repository scaffolding, Prisma/Next.js boilerplate, test-case generation, documentation structure, and repeated static/build checks. Product scope, authorization semantics, conflict behavior, and final acceptance decisions remained explicit human decisions.

## Where AI materially helped

- Translated the assignment into a focused MVP: document CRUD, Tiptap JSON, `.txt` import, two seeded users, role-based sharing, Markdown export, and PostgreSQL persistence.
- Implemented repetitive Next.js Route Handler and Prisma code while keeping access checks server-side.
- Audited autosave after the initial MVP and identified stale-request and navigation data-loss risks.
- Built a serialized client save queue and PostgreSQL optimistic concurrency control with a monotonic document version.
- Generated focused authorization, role enforcement, save-failure, import, Markdown export, and real PostgreSQL concurrency tests.
- Reviewed dashboard payloads, async error states, accessibility, and reviewer documentation.

## Output I changed or rejected

- Rejected a last-write-wins autosave design because older requests could overwrite newer edits.
- Replaced a proposed `updatedAt` concurrency token with an explicit integer `version`, making conditional updates deterministic and testable.
- Replaced native browser prompts and selects with accessible application UI.
- Removed a duplicate Tiptap underline extension after upgrading to Tiptap 3.
- Reworked an initial seed command because direct `tsx` execution did not load Prisma environment variables.
- Replaced the unsupported Vercel Node 20 target with Node 24 after Vercel deprecated Node 20 builds.
- Split and corrected generated patches when encoding/context mismatches made a large edit unsafe to apply atomically.
- Did not add CRDT, WebSockets, comments, history, or production authentication because they would weaken the core delivery within the timebox.

## How correctness was verified

- `npm test`: isolated authorization, import, save-queue ordering, retry, and version-conflict tests without Docker.
- `npm run test:integration`: applies real migrations to a dedicated Docker PostgreSQL database and proves that two concurrent writes using the same version yield exactly one success and one conflict.
- `npm run lint`: ESLint with Next.js Core Web Vitals, TypeScript, and control-flow rules.
- `npm run typecheck`: strict TypeScript validation.
- `npm run build`: Prisma generation plus a production Next.js build.
- `npm audit --omit=dev`: production dependency audit.
- Production smoke test completed against the public Vercel URL: create, save formatted content, trigger an OCC `409`, share/edit/revoke, verify a `403`, import/reopen `.txt`, and clean up generated records.
- Manual reviewer flow: create, format, refresh, import, grant Bob editor access, downgrade Bob to viewer access, verify the read-only UI and server-side `403`, export Markdown, revoke access, and verify the document is inaccessible.

## Human review checklist

- Verify every mutation derives the acting user from the server cookie rather than request payloads.
- Inspect the migration and conditional `updateMany` before production deployment.
- Re-run the complete production checklist in [REVIEW_CHECKLIST.md](./REVIEW_CHECKLIST.md) after each production deployment.
- Confirm desktop and mobile layouts, keyboard interaction, autosave failure feedback, and browser console/network cleanliness.

## Limitations of the AI-assisted result

The demo identity cookie intentionally allows switching between seeded users and is not production authentication. Conflict handling detects stale writes but does not merge them. The initial Vercel deployment and production smoke test are complete; the latest role-based release requires a Node 24 Vercel redeploy. The walkthrough recording remains the final external submission item and its URL must be recorded in `video-link.txt`.
