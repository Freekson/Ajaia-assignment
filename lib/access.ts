export type DocumentRole = "VIEWER" | "EDITOR";

export type AccessDocument = {
  ownerId: string;
  shares: Array<{ userId: string; role: DocumentRole }>;
};

export function canAccessDocument(document: AccessDocument, userId: string) {
  return document.ownerId === userId || document.shares.some((share) => share.userId === userId);
}

export function canManageDocument(document: Pick<AccessDocument, "ownerId">, userId: string) {
  return document.ownerId === userId;
}

export function canEditDocument(document: AccessDocument, userId: string) {
  return (
    document.ownerId === userId ||
    document.shares.some((share) => share.userId === userId && share.role === "EDITOR")
  );
}
