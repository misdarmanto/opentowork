"use client";

import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  completed: "default",
  failed: "destructive",
  awaiting_approval: "outline",
  running: "secondary",
};

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId),
    refetchInterval: (query) => (TERMINAL_STATUSES.has(query.state.data?.run.status ?? "") ? false : 3000),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["run", runId] });
    queryClient.invalidateQueries({ queryKey: ["runs"] });
    queryClient.invalidateQueries({ queryKey: ["approvals"] });
  };

  const approveMutation = useMutation({ mutationFn: () => api.approveRun(runId), onSuccess: invalidate });
  const rejectMutation = useMutation({ mutationFn: () => api.rejectRun(runId), onSuccess: invalidate });
  const resumeMutation = useMutation({ mutationFn: () => api.resumeRun(runId), onSuccess: invalidate });

  if (runQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (runQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(runQuery.error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const { run, steps, pendingApproval } = runQuery.data!;
  const busy = approveMutation.isPending || rejectMutation.isPending || resumeMutation.isPending;
  const mutationError = approveMutation.error ?? rejectMutation.error ?? resumeMutation.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{run.workflowName}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{run.id}</span>
            <Badge variant={STATUS_VARIANT[run.status] ?? "secondary"}>{run.status}</Badge>
          </p>
        </div>
      </div>

      {run.errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Run failed</AlertTitle>
          <AlertDescription>{run.errorMessage}</AlertDescription>
        </Alert>
      )}

      {mutationError && (
        <Alert variant="destructive">
          <AlertDescription>{(mutationError as Error).message}</AlertDescription>
        </Alert>
      )}

      {pendingApproval && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm">
              Waiting on your review of step <span className="font-medium">{pendingApproval.stepName}</span>.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" disabled={busy} onClick={() => approveMutation.mutate()}>
                <CheckCircle2 className="size-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => rejectMutation.mutate()}>
                <XCircle className="size-3.5" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {run.status === "running" && !pendingApproval && (
        <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => resumeMutation.mutate()}>
          <RotateCcw className="size-3.5" />
          Resume (looks stalled - click if the process restarted mid-run)
        </Button>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Steps</h2>
        <div className="flex flex-col gap-3">
          {steps.length === 0 && (
            <p className="text-sm text-muted-foreground">No steps recorded yet.</p>
          )}
          {steps.map((step) => (
            <Card key={step.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">{step.stepName}</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">
                    {step.status}
                  </Badge>
                  <span>{(step.inputTokens ?? 0) + (step.outputTokens ?? 0)} tokens</span>
                  <span>${(step.cost ?? 0).toFixed(4)}</span>
                </div>
              </CardHeader>
              {step.output && (
                <CardContent>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">{step.output}</pre>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
