import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { findProjectRoot } from "@/lib/server/project-root";

export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[id]/artifacts">) {
  const { id } = await ctx.params;
  const projectRoot = findProjectRoot();
  const artifactsDir = path.join(projectRoot, ".open-work", "runs", id, "artifacts");

  try {
    if (!fs.existsSync(artifactsDir)) {
      return NextResponse.json({ artifacts: [] });
    }

    const files = fs.readdirSync(artifactsDir);
    const artifacts = files
      .filter(file => {
        const filePath = path.join(artifactsDir, file);
        return fs.statSync(filePath).isFile();
      })
      .map(file => ({
        name: file,
        size: fs.statSync(path.join(artifactsDir, file)).size,
      }));

    return NextResponse.json({ artifacts });
  } catch (error) {
    return NextResponse.json({ error: "Failed to read artifacts", artifacts: [] }, { status: 500 });
  }
}
