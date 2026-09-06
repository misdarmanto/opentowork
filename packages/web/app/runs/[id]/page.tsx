"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

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

  if (runQuery.isLoading) return <p className="text-sm opacity-70">Loading…</p>;
  if (runQuery.isError) return <p className="text-sm text-red-700 dark:text-red-400">{(runQuery.error as Error).message}</p>;

  const { run, steps, pendingApproval } = runQuery.data!;
  const busy = approveMutation.isPending || rejectMutation.isPending || resumeMutation.isPending;
  const mutationError = approveMutation.error ?? rejectMutation.error ?? resumeMutation.error;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">{run.workflowName}</h1>
        <p className="text-sm opacity-70 mt-1">
          Run <code>{run.id}</code> — status <strong>{run.status}</strong>
          {run.errorMessage && <span className="text-red-700 dark:text-red-400"> — {run.errorMessage}</span>}
        </p>
      </div>

      {mutationError && <p className="text-sm text-red-700 dark:text-red-400">{(mutationError as Error).message}</p>}

      {pendingApproval && (
        <div className="border border-amber-500/40 bg-amber-500/5 rounded-md p-4 flex items-center justify-between">
          <span className="text-sm">
            Waiting on your review of step <strong>{pendingApproval.stepName}</strong>.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              className="text-sm bg-black text-white dark:bg-white dark:text-black rounded px-3 py-1 disabled:opacity-50"
              onClick={() => approveMutation.mutate()}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              className="text-sm border border-black/20 dark:border-white/30 rounded px-3 py-1 disabled:opacity-50"
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {run.status === "running" && !pendingApproval && (
        <button
          type="button"
          disabled={busy}
          className="self-start text-sm border border-black/20 dark:border-white/30 rounded px-3 py-1 disabled:opacity-50"
          onClick={() => resumeMutation.mutate()}
        >
          Resume (looks stalled — click if the process restarted mid-run)
        </button>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2 opacity-70">Steps</h2>
        <ol className="flex flex-col gap-3">
          {steps.map((step) => (
            <li key={step.id} className="border border-black/10 dark:border-white/15 rounded-md p-3">
              <div className="flex items-center justify-between text-sm">
                <strong>{step.stepName}</strong>
                <span className="opacity-70">
                  {step.status} · {(step.inputTokens ?? 0) + (step.outputTokens ?? 0)} tokens · $
                  {(step.cost ?? 0).toFixed(4)}
                </span>
              </div>
              {step.output && <pre className="mt-2 text-sm whitespace-pre-wrap font-sans">{step.output}</pre>}
            </li>
          ))}
          {steps.length === 0 && <p className="text-sm opacity-70">No steps recorded yet.</p>}
        </ol>
      </section>
    </div>
  );
}
