"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  Plug,
  Plus,
  Sparkles,
  Users,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: WorkflowIcon },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/connectors", label: "Connectors", icon: Plug },
];

const STORAGE_KEY = "open-work:sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // localStorage can throw in a locked-down browser context - default (expanded) is fine.
    }
  }, []);

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

      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {collapsed ? "OW" : "Open Work - self-hosted, AGPL-3.0"}
      </div>
    </aside>
  );
}
