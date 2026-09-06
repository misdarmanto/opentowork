import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  const store = getStore();

  const run = store.getRun(id);
  if (!run) {
    return NextResponse.json({ error: `No run found with id "${id}"` }, { status: 404 });
  }

  const steps = store.listSteps(id);
  const pendingApproval = store.getPendingApprovalForRun(id);

  return NextResponse.json({ run, steps, pendingApproval });
}
