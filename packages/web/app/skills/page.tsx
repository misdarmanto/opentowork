"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkillsPage() {
  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: api.listSkills });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable capability packages in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">config/skills/*.yaml</code> — instructions
            appended to an employee's system prompt, plus any tools the skill contributes.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/skills/new" />}>
          <Plus className="size-4" /> New skill
        </Button>
      </div>

      {skillsQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {skillsQuery.data?.skills.map((s) => (
            <Card key={s.name}>
              <CardHeader className="gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">{s.name}</h2>
                  {s.tools.length > 0 && <Badge variant="secondary">{s.tools.length} tool(s)</Badge>}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{s.instructions}</p>
              </CardHeader>
            </Card>
          ))}
          {skillsQuery.data?.skills.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">No skills yet.</CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
