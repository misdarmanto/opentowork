"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  completed: "default",
  failed: "destructive",
  awaiting_approval: "outline",
  running: "secondary",
};

export default function DashboardPage() {
  const approvalsQuery = useQuery({
    queryKey: ["approvals"],
    queryFn: api.listApprovals,
    refetchInterval: 5000,
  });
  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: api.listRuns,
    refetchInterval: 5000,
  });

  const pending = approvalsQuery.data?.pending ?? [];
  const runs = (runsQuery.data?.runs ?? [])
    .slice()
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What needs your attention, and what's happened recently.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {approvalsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : pending.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Inbox className="size-4" />
              Nothing waiting on you right now.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="text-sm">
                    Step <span className="font-medium">{a.stepName}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {a.runId.slice(0, 8)}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/runs/${a.runId}`} />}>
                    Review <ArrowRight className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : runs.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No runs yet - trigger one from{" "}
              <Link href="/workflows" className="underline underline-offset-2">
                Workflows
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/runs/${run.id}`} className="underline underline-offset-2">
                        {run.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>{run.workflowName}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[run.status] ?? "secondary"}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      ${(run.totalCost ?? 0).toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
