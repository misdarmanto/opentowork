"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Workflow } from "@open-work/core";

type Step = Workflow["steps"][number];
type HumanStep = Extract<Step, { assignee: "human" }>;

// Duplicated from @open-work/core's isHumanStep rather than imported - see
// the identical note in ../page.tsx for why (client bundle can't pull in
// the executor/store/tools modules that live behind the barrel export).
function isHumanStep(step: Step): step is HumanStep {
  return "assignee" in step && step.assignee === "human";
}

export default function WorkflowDetailPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");

  const workflowQuery = useQuery({
    queryKey: ["workflow", name],
    queryFn: () => api.getWorkflow(name),
    retry: false,
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerRun(name, topic ? { topic } : {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      router.push(`/runs/${data.state.runId}`);
    },
  });

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
        </>
      )}
    </div>
  );
}
