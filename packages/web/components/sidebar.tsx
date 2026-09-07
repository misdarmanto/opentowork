"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plug, Plus, Sparkles, Users, Workflow as WorkflowIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: WorkflowIcon },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/connectors", label: "Connectors", icon: Plug },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-background">
      <Link href="/" className="flex items-center gap-2 px-4 py-4 font-semibold tracking-tight">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          OW
        </span>
        Open Work
      </Link>

      <div className="px-3">
        <Button size="sm" className="w-full" nativeButton={false} render={<Link href="/workflows/new" />}>
          <Plus className="size-4" /> New workflow
        </Button>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Open Work - self-hosted, AGPL-3.0
      </div>
    </aside>
  );
}
