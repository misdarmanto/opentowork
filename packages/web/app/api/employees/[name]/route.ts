import { NextResponse } from "next/server";
import { buildEmployeeFromForm, deleteEmployee, saveEmployee, type EmployeeFormInput } from "@/lib/server/workflows";
import { apiLogger } from "@/lib/server/logger";

/**
 * Renaming isn't supported here - the route param names the file to
 * overwrite, and the request body's `name` is forced to match it. To rename
 * an employee, create a new one and delete the old file by hand.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const input = (await request.json()) as EmployeeFormInput;
    const { employee, yamlText } = buildEmployeeFromForm({ ...input, name });
    saveEmployee(employee, yamlText, { overwrite: true });
    return NextResponse.json({ employee, yamlText });
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/employees/[name]", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    deleteEmployee(name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/employees/[name]", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
