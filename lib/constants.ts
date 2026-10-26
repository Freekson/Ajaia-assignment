export const DEMO_USERS = [
  { id: "demo-alice", name: "Alice Morgan", email: "alice@ajaia.demo" },
  { id: "demo-bob", name: "Bob Chen", email: "bob@ajaia.demo" },
] as const;

export const USER_COOKIE = "ajaia_user_id";
export const DEFAULT_USER_ID = DEMO_USERS[0].id;
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] } as const;
