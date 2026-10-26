# Reviewer and Production Checklist

## Automated baseline

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

All four commands must pass from a clean install. The integration command uses only the dedicated `ajaia_docs_test` database and stops its Docker container even when a migration or test fails.

## Main reviewer flow

1. Open the app in a fresh browser session and select Alice.
2. Create a document, rename it, and add bold, italic, underline, headings, and both list types.
3. Wait for `Saved`, refresh, and confirm content and formatting persist.
4. Navigate immediately after a rapid edit and verify the latest edit is present after reopening.
5. Share the document with Bob, switch users, and find it under `Shared with me`.
6. Edit as Bob, refresh, and verify persistence. Confirm Bob cannot rename or manage sharing.
7. Open an unshared Alice document directly as Bob and confirm access is denied.
8. Import a valid `.txt` file. Then try an unsupported extension and a file larger than 1 MB.

## Reliability scenarios

- Open one document in two tabs. Save in the first tab, then edit in the second. Confirm the second receives conflict UI and the first tab's server content is unchanged.
- Disable the network, edit, and confirm `Save failed` plus Retry. Re-enable the network and retry without losing the draft.
- Edit and immediately use the in-app Back button or user switcher. Confirm navigation waits for save.
- Edit and refresh or close the tab. Confirm the browser displays its unsaved-change warning.

## Production-only checks

- Confirm Neon uses the pooled URL for `DATABASE_URL` and direct URL for `DIRECT_URL`.
- Apply migrations and seed Alice/Bob before sharing the reviewer URL.
- Repeat the main flow against Vercel in a private/incognito window.
- Inspect the browser console and failed network requests.
- Confirm the deployment URL works without local services or credentials.
- Record the final URL in `SUBMISSION.md` and the walkthrough URL in `video-link.txt`.
