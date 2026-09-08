/**
 * Shared between lib/server/auth.ts (Server Components/Route Handlers, via
 * next/headers) and proxy.ts (via NextRequest/NextResponse's own cookies
 * API) - kept in its own module with no other imports so proxy.ts's bundle
 * never pulls in next/headers, which only works in a request-scoped
 * Server Component/Route Handler context, not Proxy.
 */
export const SESSION_COOKIE = "open_work_session";
