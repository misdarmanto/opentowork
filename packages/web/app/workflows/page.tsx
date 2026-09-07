"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight, Play, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import type { Workflow } from "@open-work/core";

type Step = Workflow["steps"][number];
type HumanStep = Extract<Step, { assignee: "human" }>;

/**
 * Duplicated from @open-work/core's isHumanStep rather than imported: this
 * file is a client component, and @open-work/core's single barrel export
 * re-exports the executor/store/tools modules too (SQLite, child_process),
 * which can't be bundled for the browser. Importing only `type Workflow`
 * (erased at compile time) is safe; importing a real function isn't. If
 * this duplication becomes annoying, give @open-work/core a client-safe
 * subpath export instead of splitting the check further.
 */
function isHumanStep(step: Step): step is HumanStep {
  return "assignee" in step && step.assignee === "human";
}

export default function WorkflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const workflowsQuery = useQuery({ queryKey: ["workflows"], queryFn: api.listWorkflows });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paramsByWorkflow, setParamsByWorkflow] = useState<Record<string, string>>({});

  const triggerMutation = useMutation({
    mutationFn: ({ name, topic }: { name: string; topic: string }) => api.triggerRun(name, topic ? { topic } : {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      router.push(`/runs/${data.state.runId}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defined in <code className="rounded bg-muted px-1 py-0.5 text-xs">config/workflows/*.yaml</code> - git-committed, not a database row.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/workflows/new" />}>
          <Plus className="size-4" /> New workflow
        </Button>
      </div>

      {triggerMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(triggerMutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {workflowsQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {workflowsQuery.data?.workflows.map((wf) => {
            const isExpanded = expanded === wf.name;
            return (
              <Card key={wf.name}>
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-medium">{wf.name}</h2>
                      {wf.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{wf.description}</p>
                      )}
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setExpanded(isExpanded ? null : wf.name)}
                      >
                        {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        {wf.steps.length} step{wf.steps.length === 1 ? "" : "s"}
                      </button>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Input
                        placeholder="topic (optional)"
                        className="w-48"
                        value={paramsByWorkflow[wf.name] ?? ""}
                        onChange={(e) => setParamsByWorkflow((p) => ({ ...p, [wf.name]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        disabled={triggerMutation.isPending}
                        onClick={() => triggerMutation.mutate({ name: wf.name, topic: paramsByWorkflow[wf.name] ?? "" })}
                      >
                        <Play className="size-3.5" />
                        {triggerMutation.isPending ? "Starting…" : "Run"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="border-t border-border pt-4">
                    <ol className="flex flex-col gap-2 text-sm">
                      {wf.steps.map((step, i) => (
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
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
