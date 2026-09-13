"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings as SettingsIcon,
  SlidersHorizontal,
  User,
  Users,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: WorkflowIcon },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/customize", label: "Customize", icon: SlidersHorizontal },
];

const SECONDARY_ITEMS = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

const STORAGE_KEY = "open-work:sidebar-collapsed";
const WORKFLOWS_EXPANDED_KEY = "open-work:sidebar-workflows-expanded";

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [workflowsExpanded, setWorkflowsExpanded] = useState(false);
  const workflowsQuery = useQuery({ queryKey: ["workflows"], queryFn: api.listWorkflows });

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
      setWorkflowsExpanded(localStorage.getItem(WORKFLOWS_EXPANDED_KEY) === "true");
    } catch {
      // localStorage can throw in a locked-down browser context - default (expanded) is fine.
    }
  }, []);

  const toggleWorkflowsExpanded = () => {
    setWorkflowsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(WORKFLOWS_EXPANDED_KEY, String(next));
      } catch {
        // per-viewer convenience only - losing it just means it doesn't persist.
      }
      return next;
    });
  };

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // per-viewer convenience only - losing it just means it doesn't persist.
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-background transition-[width] duration-150",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex gap-2 px-3 py-4", collapsed ? "flex-col items-center" : "items-center justify-between")}>
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            OW
          </span>
          {!collapsed && <span className="truncate">Open Work</span>}
        </Link>
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>

      <div className="px-3">
        <Button
          size="sm"
          className={cn("w-full", collapsed && "px-0")}
          nativeButton={false}
          render={<Link href="/workflows?new=1" title="New workflow" />}
        >
          <Plus className="size-4" />
          {!collapsed && "New workflow"}
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) =>
          item.href === "/workflows" && !collapsed ? (
            <div key={item.href} className="flex flex-col">
              <button
                type="button"
                onClick={toggleWorkflowsExpanded}
                aria-expanded={workflowsExpanded}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  pathname.startsWith("/workflows")
                    ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronRight
                  className={cn("size-3.5 shrink-0 transition-transform duration-150", workflowsExpanded && "rotate-90")}
                />
              </button>
              {workflowsExpanded && (
                <div className="flex flex-col gap-0.5 py-0.5 pl-9 pr-1">
                  <Link
                    href="/workflows"
                    className={cn(
                      "truncate rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      pathname === "/workflows"
                        ? "bg-secondary text-secondary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    All Workflows
                  </Link>
                  {workflowsQuery.isLoading && (
                    <span className="truncate px-2 py-1.5 text-xs text-muted-foreground">Loading…</span>
                  )}
                  {workflowsQuery.data?.workflows.length === 0 && (
                    <span className="truncate px-2 py-1.5 text-xs text-muted-foreground">No workflows yet</span>
                  )}
                  {workflowsQuery.data?.workflows.map((wf) => {
                    const href = `/workflows/${encodeURIComponent(wf.name)}`;
                    return (
                      <Link
                        key={wf.name}
                        href={href}
                        title={wf.name}
                        className={cn(
                          "truncate rounded-md px-2 py-1.5 text-xs transition-colors",
                          pathname === href
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {wf.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            renderNavLink(item, pathname, collapsed)
          ),
        )}
      </nav>

      <nav className="flex flex-col gap-1 border-t border-border p-3">
        {SECONDARY_ITEMS.map((item) => renderNavLink(item, pathname, collapsed))}
      </nav>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {collapsed ? "OW" : "Open Work - self-hosted, AGPL-3.0"}
      </div>

      <div
        className={cn(
          "flex items-center gap-2 border-t border-border px-3 py-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <Link
            href="/profile"
            className="min-w-0 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
            title={email}
          >
            {email}
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          title="Log out"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}

function renderNavLink(
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> },
  pathname: string,
  collapsed: boolean,
) {
  const { href, label, icon: Icon } = item;
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      key={href}
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
        collapsed && "justify-center px-0",
        active
          ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}
