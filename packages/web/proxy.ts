import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getStore } from "@/lib/server/store";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_API_PREFIXES = ["/api/auth/login"];

/**
 * Gates every route except the login page and the login API call itself.
 * Runs on the Node.js runtime (Proxy's default - see AGENTS.md's warning
 * that this Next.js version renamed `middleware` to `proxy`), so it's safe
 * to hit the real SQLite-backed session store directly here rather than
 * only checking cookie presence.
 *
 * app/(app)/layout.tsx re-checks the session too (redirect("/login") there
 * if missing) - defense in depth in case a future route ever falls outside
 * this file's matcher, per the framework's own guidance not to rely on
 * Proxy alone for auth.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? getStore().findSession(token) : undefined;
  const valid = session !== undefined && session.expiresAt.getTime() > Date.now();

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
