import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { findProjectRoot } from "@/lib/server/project-root";

export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[id]/artifacts/[filename]">) {
  const { id, filename } = await ctx.params;
  const projectRoot = findProjectRoot();
  const filePath = path.join(projectRoot, ".open-work", "runs", id, "artifacts", filename as string);

  try {
    // Prevent directory traversal
    if (!filePath.startsWith(path.join(projectRoot, ".open-work", "runs", id, "artifacts"))) {
      return NextResponse.json({ error: "Invalid artifact path" }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to read artifact" }, { status: 500 });
  }
}
