import { NextResponse } from "next/server";
import { buildEmployeeFromForm, listEmployees, saveEmployee, type EmployeeFormInput } from "@/lib/server/workflows";

export async function GET() {
  try {
    const employees = listEmployees();
    return NextResponse.json({ employees });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as EmployeeFormInput;
    const { employee, yamlText } = buildEmployeeFromForm(input);
    saveEmployee(employee, yamlText);
    return NextResponse.json({ employee, yamlText }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
