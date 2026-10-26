const baseUrl = (process.argv[2] ?? "").replace(/\/$/, "");

if (!baseUrl.startsWith("https://")) {
  console.error("Usage: npm run smoke:production -- https://your-app.vercel.app");
  process.exit(1);
}

let cookie = "";

async function request(path, options = {}, expectedStatus = 200) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const body = await response.json().catch(() => null);
  if (response.status !== expectedStatus) {
    throw new Error(
      `${options.method ?? "GET"} ${path}: expected ${expectedStatus}, received ${response.status}. ${JSON.stringify(body)}`,
    );
  }
  return body;
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

try {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const created = await request("/api/documents", { method: "POST" }, 201);
  const saved = await request(
    `/api/documents/${created.id}`,
    json("PATCH", {
      version: 1,
      name: `Production smoke test ${stamp}`,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Production verified" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", marks: [{ type: "bold" }], text: "Formatting persisted." }],
          },
        ],
      },
    }),
  );
  if (saved.version !== 2) throw new Error(`Expected version 2, received ${saved.version}.`);

  const conflict = await request(
    `/api/documents/${created.id}`,
    json("PATCH", {
      version: 1,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "stale" }] }],
      },
    }),
    409,
  );
  if (conflict.code !== "VERSION_CONFLICT")
    throw new Error("Stale update did not return VERSION_CONFLICT.");

  await request(
    `/api/documents/${created.id}/shares`,
    json("POST", { userId: "demo-bob", role: "EDITOR" }),
    201,
  );
  await request("/api/session", json("POST", { userId: "demo-bob" }));
  const shared = await request(`/api/documents/${created.id}`);
  if (shared.version !== 2) throw new Error("Bob did not receive the expected shared version.");

  const bobSaved = await request(
    `/api/documents/${created.id}`,
    json("PATCH", {
      version: 2,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Production verified" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", marks: [{ type: "italic" }], text: "Edited successfully as Bob." },
            ],
          },
        ],
      },
    }),
  );
  if (bobSaved.version !== 3)
    throw new Error(`Expected Bob's save to produce version 3, received ${bobSaved.version}.`);

  await request("/api/session", json("POST", { userId: "demo-alice" }));
  await request(
    `/api/documents/${created.id}/shares`,
    json("POST", { userId: "demo-bob", role: "VIEWER" }),
    201,
  );
  await request("/api/session", json("POST", { userId: "demo-bob" }));
  await request(`/api/documents/${created.id}`);
  await request(
    `/api/documents/${created.id}`,
    json("PATCH", {
      version: 3,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "blocked" }] }],
      },
    }),
    403,
  );

  await request("/api/session", json("POST", { userId: "demo-alice" }));
  await request(`/api/documents/${created.id}/shares`, json("DELETE", { userId: "demo-bob" }));

  const form = new FormData();
  form.set(
    "file",
    new Blob(["Imported from the production smoke test.\nThis document is editable."], {
      type: "text/plain",
    }),
    `Production smoke import ${stamp}.txt`,
  );
  const imported = await request("/api/documents/import", { method: "POST", body: form }, 201);
  const reopenedImport = await request(`/api/documents/${imported.id}`);
  if (reopenedImport.content?.type !== "doc")
    throw new Error("Imported document did not reopen as Tiptap JSON.");

  await request("/api/session", json("POST", { userId: "demo-bob" }));
  await request(`/api/documents/${created.id}`, {}, 403);
  await request(`/api/documents/${created.id}`, { method: "DELETE" }, 403);

  await request("/api/session", json("POST", { userId: "demo-alice" }));
  await request(`/api/documents/${created.id}`, { method: "DELETE" }, 204);
  await request(`/api/documents/${imported.id}`, { method: "DELETE" }, 204);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        deployment: baseUrl,
        documentId: created.id,
        importedDocumentId: imported.id,
        checks: [
          "create",
          "formatted save",
          "version conflict",
          "share",
          "editor write",
          "viewer read",
          "viewer write rejection",
          "revoke",
          "forbidden access",
          "txt import",
          "reopen",
          "owner-only delete",
          "cleanup",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
