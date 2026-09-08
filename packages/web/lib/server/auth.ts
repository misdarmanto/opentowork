import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getStore } from "./store";
import { SESSION_COOKIE } from "../session-cookie";

export { SESSION_COOKIE };
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  email: string;
}

/** Reads the session cookie and resolves it to a real, non-expired user - or null. Never throws on a missing/garbage cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const store = getStore();
  const session = store.findSession(token);
  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  const user = store.findUserById(session.userId);
  if (!user) return null;

  return { id: user.id, email: user.email };
}

/** Creates a durable session row and returns the token plus its expiry - the caller sets the actual cookie on the response. */
export function createSessionToken(userId: string): { token: string; expiresAt: Date } {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  getStore().createSession({ id: token, userId, expiresAt });
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  getStore().deleteSession(token);
}
