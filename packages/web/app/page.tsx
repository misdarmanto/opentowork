"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  completed: "text-green-700 dark:text-green-400",
  failed: "text-red-700 dark:text-red-400",
  awaiting_approval: "text-amber-700 dark:text-amber-400",
  running: "text-blue-700 dark:text-blue-400",
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

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-lg font-semibold mb-3">Pending approvals</h1>
        {approvalsQuery.isLoading && <p className="text-sm opacity-70">Loading…</p>}
        {approvalsQuery.data?.pending.length === 0 && (
          <p className="text-sm opacity-70">Nothing waiting on you right now.</p>
        )}
        <ul className="flex flex-col gap-2">
          {approvalsQuery.data?.pending.map((a) => (
            <li key={a.id} className="border border-black/10 dark:border-white/15 rounded-md p-3 text-sm flex items-center justify-between">
              <span>
                Step <strong>{a.stepName}</strong> — run <code className="opacity-70">{a.runId.slice(0, 8)}</code>
              </span>
              <Link href={`/runs/${a.runId}`} className="underline">
                Review →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h1 className="text-lg font-semibold mb-3">Recent runs</h1>
        {runsQuery.isLoading && <p className="text-sm opacity-70">Loading…</p>}
        {runsQuery.data?.runs.length === 0 && <p className="text-sm opacity-70">No runs yet — trigger one from Workflows.</p>}
        <table className="w-full text-sm">
          <thead className="text-left opacity-60">
            <tr>
              <th className="font-normal py-1">Run</th>
              <th className="font-normal py-1">Workflow</th>
              <th className="font-normal py-1">Status</th>
              <th className="font-normal py-1">Cost</th>
            </tr>
          </thead>
          <tbody>
            {runsQuery.data?.runs
              .slice()
              .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
              .map((run) => (
                <tr key={run.id} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-2">
                    <Link href={`/runs/${run.id}`} className="underline">
                      {run.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-2">{run.workflowName}</td>
                  <td className={`py-2 ${STATUS_COLOR[run.status] ?? ""}`}>{run.status}</td>
                  <td className="py-2">${(run.totalCost ?? 0).toFixed(4)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
