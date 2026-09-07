"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConnectorsPage() {
  const connectorsQuery = useQuery({ queryKey: ["connectors"], queryFn: api.listConnectors });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connectors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable tool configs in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">config/connectors/*.yaml</code> - attach one to
            any employee by name instead of repeating the MCP/custom setup.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/connectors/new" />}>
          <Plus className="size-4" /> New connector
        </Button>
      </div>

      {connectorsQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {connectorsQuery.data?.connectors.map((c) => (
            <Card key={c.name}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <h2 className="font-medium">{c.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.type === "mcp" ? `${c.command} ${c.args.join(" ")}` : c.path}
                  </p>
                </div>
                <Badge variant="secondary">{c.type}</Badge>
              </CardHeader>
            </Card>
          ))}
          {connectorsQuery.data?.connectors.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No connectors yet.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
