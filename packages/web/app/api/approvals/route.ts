import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";

export async function GET() {
  const pending = getStore().listPendingApprovals();
  return NextResponse.json({ pending });
}
