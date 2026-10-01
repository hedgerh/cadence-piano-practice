// Pure route helpers (no IPC imports, so unit-tested views can use them).

/** Route for a started session, by level kind (chord practice vs ear drill). */
export function sessionRoute(session: { sessionId: string; levelId: string; isEar: boolean }) {
  const base = session.isEar ? `/ear/${session.levelId}` : `/practice/${session.levelId}`;
  return `${base}?session=${encodeURIComponent(session.sessionId)}`;
}
