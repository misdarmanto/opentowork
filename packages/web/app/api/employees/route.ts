import { NextResponse } from "next/server";
import { listEmployees } from "@/lib/server/workflows";

export async function GET() {
  try {
    const employees = listEmployees();
    return NextResponse.json({ employees });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
