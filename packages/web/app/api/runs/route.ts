import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { getWorkflow } from "@/lib/server/workflows";
import { triggerRun } from "@/lib/server/executor";
import { apiLogger } from "@/lib/server/logger";

export async function GET() {
  const runs = getStore().listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { workflow?: string; params?: Record<string, string> };
    if (!body.workflow) {
      return NextResponse.json({ error: "workflow is required" }, { status: 400 });
    }

    const workflow = getWorkflow(body.workflow);
    if (!workflow) {
      return NextResponse.json({ error: `No workflow named "${body.workflow}"` }, { status: 404 });
    }

    const runId = randomUUID();
    const state = await triggerRun(workflow, body.params ?? {}, runId);
    return NextResponse.json({ state }, { status: 201 });
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/runs", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
