"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Skill } from "@open-work/core";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SkillForm } from "@/components/forms/skill-form";
import { AlertTriangle } from "lucide-react";

type DialogState = { mode: "create" } | { mode: "edit"; skill: Skill } | null;
type DeleteConfirmState = { skillName: string } | null;

export function SkillsTab() {
  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: api.listSkills });
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [formKey, setFormKey] = useState(0);

  const deleteSkillMutation = useMutation({
    mutationFn: (skillName: string) => api.deleteSkill?.(skillName) || Promise.resolve({ ok: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      setDeleteConfirm(null);
    },
  });

  const openCreate = () => {
    setFormKey((k) => k + 1);
    setDialogState({ mode: "create" });
  };

  const openEdit = (skill: Skill) => {
    setFormKey((k) => k + 1);
    setDialogState({ mode: "edit", skill });
  };

  const close = () => setDialogState(null);

  const handleDeleteClick = (skillName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ skillName });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirm) {
      await deleteSkillMutation.mutateAsync(deleteConfirm.skillName);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reusable capability packages in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">config/skills/*.yaml</code> - instructions appended
          to an employee's system prompt, plus any tools the skill contributes.
        </p>
        <Button onClick={openCreate} className="shrink-0">
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
          <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden pr-2">
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

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-600" />
              Delete Skill
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the skill <span className="font-semibold">{deleteConfirm?.skillName}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteSkillMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteSkillMutation.isPending}
              >
                {deleteSkillMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {deleteSkillMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(deleteSkillMutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {skillsQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <Card className="gap-0 divide-y divide-border overflow-hidden py-0">
          {skillsQuery.data?.skills.map((s) => (
            <div
              key={s.name}
              className="flex w-full items-center gap-3 px-4 py-3 group hover:bg-muted transition-colors"
            >
              <button
                type="button"
                onClick={() => openEdit(s)}
                className="flex flex-1 items-center gap-3 text-left"
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
              <button
                type="button"
                onClick={(e) => handleDeleteClick(s.name, e)}
                className="flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete skill"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {skillsQuery.data?.skills.length === 0 && (
            <CardContent className="py-8 text-center text-sm text-muted-foreground">No skills yet.</CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
