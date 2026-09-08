import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { getSessionUser } from "@/lib/server/auth";

/**
 * Every page under this route group is the authenticated app shell -
 * sidebar plus content. proxy.ts already redirects an unauthenticated
 * request before it gets this far, but a Server Component checking again
 * here means this layout is safe even if a future route bypasses the proxy
 * matcher (see proxy.ts's own comment on why both checks exist).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-full">
      <Sidebar email={user.email} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
