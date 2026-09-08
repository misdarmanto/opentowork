import { NextResponse } from "next/server";
import { getWorkflow } from "@/lib/server/workflows";
import { apiLogger } from "@/lib/server/logger";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const workflow = getWorkflow(name);
    if (!workflow) return NextResponse.json({ error: `Workflow "${name}" not found` }, { status: 404 });
    return NextResponse.json({ workflow });
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/workflows/[name]", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
