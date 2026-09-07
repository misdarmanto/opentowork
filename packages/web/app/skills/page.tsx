"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Skill } from "@open-work/core";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillForm } from "@/components/forms/skill-form";

type DialogState = { mode: "create" } | { mode: "edit"; skill: Skill } | null;

export default function SkillsPage() {
  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: api.listSkills });
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [formKey, setFormKey] = useState(0);

  const openCreate = () => {
    setFormKey((k) => k + 1);
    setDialogState({ mode: "create" });
  };

  const openEdit = (skill: Skill) => {
    setFormKey((k) => k + 1);
    setDialogState({ mode: "edit", skill });
  };

  const close = () => setDialogState(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable capability packages in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">config/skills/*.yaml</code> - instructions
            appended to an employee's system prompt, plus any tools the skill contributes.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> New skill
        </Button>
      </div>

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogState?.mode === "edit" ? dialogState.skill.name : "New skill"}</DialogTitle>
            <DialogDescription>
              Instructions get appended to the system prompt of any employee that lists this skill.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {dialogState && (
              <SkillForm
                key={formKey}
                skill={dialogState.mode === "edit" ? dialogState.skill : undefined}
                onCreated={close}
                onCancel={close}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {skillsQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <Card className="gap-0 divide-y divide-border overflow-hidden py-0">
          {skillsQuery.data?.skills.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => openEdit(s)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Sparkles className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="shrink-0 font-medium">{s.name}</span>
                <span className="truncate text-sm text-muted-foreground">{s.instructions}</span>
              </div>
              {s.tools.length > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {s.tools.length} tool{s.tools.length === 1 ? "" : "s"}
                </Badge>
              )}
            </button>
          ))}
          {skillsQuery.data?.skills.length === 0 && (
            <CardContent className="py-8 text-center text-sm text-muted-foreground">No skills yet.</CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
