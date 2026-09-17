"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, Play } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Workflow } from "@open-work/core";

type Step = Workflow["steps"][number];
type HumanStep = Extract<Step, { assignee: "human" }>;

function isHumanStep(step: Step): step is HumanStep {
  return "assignee" in step && step.assignee === "human";
}

const ITEMS_PER_PAGE = 5;

export default function WorkflowDetailPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const workflowQuery = useQuery({
    queryKey: ["workflow", name],
    queryFn: () => api.getWorkflow(name),
    retry: false,
  });

  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: () => api.listRuns(),
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerRun(name, topic ? { topic } : {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      router.push(`/runs/${data.state.runId}`);
    },
  });

  // Sort runs by startedAt descending (newest first)
  const workflowRuns = (runsQuery.data?.runs.filter((r) => r.workflowName === name) || [])
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const totalPages = Math.ceil(workflowRuns.length / ITEMS_PER_PAGE);
  const paginatedRuns = workflowRuns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/workflows"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All workflows
        </Link>
      </div>

      {workflowQuery.isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {workflowQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(workflowQuery.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {workflowQuery.data && (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{workflowQuery.data.workflow.name}</h1>
            {workflowQuery.data.workflow.description && (
              <p className="mt-1 text-sm text-muted-foreground">{workflowQuery.data.workflow.description}</p>
            )}
          </div>

          {triggerMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{(triggerMutation.error as Error).message}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <h2 className="font-medium">Run this workflow</h2>
              <div className="flex shrink-0 items-center gap-2">
                <Input
                  placeholder="topic (optional)"
                  className="w-48"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <Button size="sm" disabled={triggerMutation.isPending} onClick={() => triggerMutation.mutate()}>
                  <Play className="size-3.5" />
                  {triggerMutation.isPending ? "Starting…" : "Run"}
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-medium">
                {workflowQuery.data.workflow.steps.length} step
                {workflowQuery.data.workflow.steps.length === 1 ? "" : "s"}
              </h2>
            </CardHeader>
            <CardContent className="border-t border-border pt-4">
              <ol className="flex flex-col gap-2 text-sm">
                {workflowQuery.data.workflow.steps.map((step, i) => (
                  <li key={step.name} className="flex items-start gap-2">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {i + 1}
                    </Badge>
                    {isHumanStep(step) ? (
                      <span>
                        <span className="font-medium">{step.name}</span>{" "}
                        <span className="text-muted-foreground">- human approval</span>
                      </span>
                    ) : (
                      <span>
                        <span className="font-medium">{step.name}</span>{" "}
                        <span className="text-muted-foreground">
                          - {step.employee}: {step.handoff.objective}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {workflowRuns.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Run History</h2>
                <p className="text-sm text-muted-foreground">
                  {workflowRuns.length} total run{workflowRuns.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex flex-col gap-4">
                {paginatedRuns.map((run) => (
                  <RunCard key={run.id} runId={run.id} run={run} formatBytes={formatBytes} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RunCard({ runId, run, formatBytes }: { runId: string; run: any; formatBytes: (bytes: number) => string }) {
  const artifactsQuery = useQuery({
    queryKey: ["artifacts", runId],
    queryFn: () => api.listArtifacts(runId),
  });

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/runs/${runId}`} className="font-semibold text-blue-600 hover:text-blue-700 underline">
              {new Date(run.startedAt).toLocaleString()}
            </Link>
            <p className="text-xs text-muted-foreground mt-1">
              <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "outline"}>
                {run.status}
              </Badge>
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-mono">${(run.totalCost ?? 0).toFixed(4)}</p>
          </div>
        </div>
      </CardHeader>

      {artifactsQuery.data?.artifacts && artifactsQuery.data.artifacts.length > 0 && (
        <CardContent className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-medium mb-3 text-slate-700">Artifacts</h3>
          <div className="flex flex-col gap-2">
            {artifactsQuery.data.artifacts.map((artifact) => (
              <div
                key={artifact.name}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{artifact.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(artifact.size)}</p>
                  </div>
                </div>
                <a
                  href={`/api/runs/${runId}/artifacts/${encodeURIComponent(artifact.name)}`}
                  download={artifact.name}
                  className="inline-flex items-center gap-1 rounded bg-blue-600 text-white hover:bg-blue-700 px-2 py-1 text-xs font-medium transition-colors"
                >
                  <Download className="size-3" />
                  Download
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
