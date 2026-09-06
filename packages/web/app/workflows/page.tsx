"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Workflow } from "@open-work/core";

/**
 * Duplicated from @open-work/core's isHumanStep rather than imported: this
 * file is a client component, and @open-work/core's single barrel export
 * re-exports the executor/store/tools modules too (SQLite, child_process),
 * which can't be bundled for the browser. Importing only `type Workflow`
 * (erased at compile time) is safe; importing a real function isn't. If
 * this duplication becomes annoying, give @open-work/core a client-safe
 * subpath export instead of splitting the check further.
 */
type Step = Workflow["steps"][number];
type HumanStep = Extract<Step, { assignee: "human" }>;

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Workflows</h1>
        <Link href="/workflows/new" className="text-sm underline">
          + New workflow
        </Link>
      </div>

      {workflowsQuery.isLoading && <p className="text-sm opacity-70">Loading…</p>}
      {triggerMutation.isError && (
        <p className="text-sm text-red-700 dark:text-red-400">{(triggerMutation.error as Error).message}</p>
      )}

      <ul className="flex flex-col gap-3">
        {workflowsQuery.data?.workflows.map((wf) => (
          <li key={wf.name} className="border border-black/10 dark:border-white/15 rounded-md p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium">{wf.name}</h2>
                {wf.description && <p className="text-sm opacity-70 mt-1">{wf.description}</p>}
                <button
                  type="button"
                  className="text-xs underline mt-2"
                  onClick={() => setExpanded(expanded === wf.name ? null : wf.name)}
                >
                  {expanded === wf.name ? "Hide steps" : `Show ${wf.steps.length} step(s)`}
                </button>
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                <input
                  type="text"
                  placeholder="topic (optional)"
                  className="border border-black/15 dark:border-white/20 rounded px-2 py-1 text-sm w-48"
                  value={paramsByWorkflow[wf.name] ?? ""}
                  onChange={(e) => setParamsByWorkflow((p) => ({ ...p, [wf.name]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={triggerMutation.isPending}
                  className="text-sm bg-black text-white dark:bg-white dark:text-black rounded px-3 py-1 disabled:opacity-50"
                  onClick={() => triggerMutation.mutate({ name: wf.name, topic: paramsByWorkflow[wf.name] ?? "" })}
                >
                  {triggerMutation.isPending ? "Starting…" : "Run"}
                </button>
              </div>
            </div>

            {expanded === wf.name && (
              <ol className="mt-3 flex flex-col gap-1 text-sm border-t border-black/5 dark:border-white/10 pt-3">
                {wf.steps.map((step) => (
                  <li key={step.name}>
                    <strong>{step.name}</strong>
                    {isHumanStep(step) ? (
                      <span className="opacity-70"> — human approval</span>
                    ) : (
                      <span className="opacity-70"> — {step.employee}: {step.handoff.objective}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
