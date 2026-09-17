"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertCircle, Clock, DollarSign, Inbox, PlayCircle } from "lucide-react";
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

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="size-4 text-green-600" />,
  failed: <AlertCircle className="size-4 text-red-600" />,
  awaiting_approval: <Clock className="size-4 text-amber-600" />,
  running: <PlayCircle className="size-4 text-blue-600" />,
};

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  trend?: string;
}) {
  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
            {trend && <p className="text-xs text-green-600 mt-1">{trend}</p>}
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-400">
            {Icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

  const stats = {
    totalRuns: runs.length,
    completedRuns: runs.filter(r => r.status === "completed").length,
    pendingApprovals: pending.length,
    totalCost: runs.reduce((sum, r) => sum + (r.totalCost ?? 0), 0),
  };

  const completionRate = stats.totalRuns > 0 
    ? Math.round((stats.completedRuns / stats.totalRuns) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-600">
          Welcome back! Here's what's happening with your workflows.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Runs" 
          value={stats.totalRuns}
          icon={<PlayCircle className="size-5" />}
        />
        <StatCard 
          title="Completed" 
          value={stats.completedRuns}
          icon={<CheckCircle2 className="size-5 text-green-600" />}
          trend={`${completionRate}% success rate`}
        />
        <StatCard 
          title="Pending Approvals" 
          value={stats.pendingApprovals}
          icon={<Clock className="size-5 text-amber-600" />}
        />
        <StatCard 
          title="Total Cost" 
          value={`$${stats.totalCost.toFixed(4)}`}
          icon={<DollarSign className="size-5 text-blue-600" />}
        />
      </div>

      {/* Pending Approvals */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-600" />
            <CardTitle>Pending Approvals</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {approvalsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : pending.length === 0 ? (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-slate-500">
              <Inbox className="size-5" />
              <span>All caught up! No approvals waiting.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-3 hover:border-amber-300 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {a.stepName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Run {a.runId.slice(0, 8)} · {new Date(a.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    className="gap-2 bg-amber-600 hover:bg-amber-700"
                    nativeButton={false} 
                    render={<Link href={`/runs/${a.runId}`} />}
                  >
                    Review <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PlayCircle className="size-5 text-blue-600" />
            <CardTitle>Recent Runs</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {runsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <Inbox className="size-8" />
              <p className="text-sm">No runs yet</p>
              <p className="text-xs">
                Get started by triggering a workflow from{" "}
                <Link href="/workflows" className="font-semibold text-blue-600 hover:text-blue-700">
                  Workflows
                </Link>
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">Run</TableHead>
                  <TableHead className="font-semibold text-slate-700">Workflow</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id} className="border-slate-100 hover:bg-slate-50">
                    <TableCell className="font-mono text-xs text-slate-600">
                      <Link href={`/runs/${run.id}`} className="text-blue-600 hover:text-blue-700 underline">
                        {run.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-900 font-medium">{run.workflowName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {STATUS_ICON[run.status]}
                        <Badge variant={STATUS_VARIANT[run.status] ?? "secondary"}>
                          {run.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
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
