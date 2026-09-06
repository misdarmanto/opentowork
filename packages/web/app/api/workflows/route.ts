import { NextResponse } from "next/server";
import { buildWorkflowFromForm, listWorkflows, saveWorkflow, type WorkflowFormInput } from "@/lib/server/workflows";

export async function GET() {
  try {
    const workflows = listWorkflows();
    return NextResponse.json({ workflows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as WorkflowFormInput;
    const { workflow, yamlText } = buildWorkflowFromForm(input);
    saveWorkflow(workflow, yamlText);
    return NextResponse.json({ workflow, yamlText }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
