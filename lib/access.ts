export type AccessDocument = { ownerId: string; shares: Array<{ userId: string }> };

export function canAccessDocument(document: AccessDocument, userId: string) {
  return document.ownerId === userId || document.shares.some((share) => share.userId === userId);
}

export function canManageDocument(document: Pick<AccessDocument, "ownerId">, userId: string) {
  return document.ownerId === userId;
}
