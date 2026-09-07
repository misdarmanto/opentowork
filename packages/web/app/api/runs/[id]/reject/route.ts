import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { getWorkflow } from "@/lib/server/workflows";
import { rejectRun } from "@/lib/server/executor";
import { apiLogger } from "@/lib/server/logger";

export async function POST(_request: Request, ctx: RouteContext<"/api/runs/[id]/reject">) {
  const { id } = await ctx.params;
  const run = getStore().getRun(id);
  if (!run) return NextResponse.json({ error: `No run found with id "${id}"` }, { status: 404 });

  const workflow = getWorkflow(run.workflowName);
  if (!workflow) return NextResponse.json({ error: `Workflow "${run.workflowName}" not found` }, { status: 404 });

  try {
    const state = await rejectRun(id, workflow);
    return NextResponse.json({ state });
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/runs/[id]/reject", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
