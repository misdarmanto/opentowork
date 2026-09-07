"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface StepDraft {
  name: string;
  employee: string;
  objective: string;
  deliverable: string;
}

function emptyStep(index: number): StepDraft {
  return { name: `step-${index + 1}`, employee: "", objective: "", deliverable: "" };
}

export function WorkflowForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: api.listEmployees });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep(0)]);
  const [requireApproval, setRequireApproval] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [savedYaml, setSavedYaml] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createWorkflow({
        name,
        description: description || undefined,
        steps: steps.map((s, i) => ({
          name: s.name,
          employee: s.employee,
          objective: s.objective,
          deliverable: s.deliverable || undefined,
          dependsOn: i > 0 ? steps[i - 1].name : undefined,
        })),
        approval: requireApproval ? { maxAttempts } : undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setSavedYaml(data.yamlText);
    },
  });

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const canSubmit = name.trim().length > 0 && steps.every((s) => s.employee && s.objective.trim());

  if (savedYaml) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Saved to <code className="font-mono">config/workflows/{name}.yaml</code>. This is a real file - open it
            in your editor, commit it to git, or edit it by hand any time.
          </AlertDescription>
        </Alert>
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-4 font-mono text-xs">{savedYaml}</pre>
        <DialogFooter>
          <Button onClick={onCreated}>Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wf-name">Workflow name</Label>
          <Input
            id="wf-name"
            value={name}
            onChange={(e) => setName(e.target.value.trim().replace(/\s+/g, "-"))}
            placeholder="my-workflow"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wf-description">Description (optional)</Label>
          <Input id="wf-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Steps (run in order)</h3>
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Input
                className="h-7 w-48 font-medium"
                value={step.name}
                onChange={(e) => updateStep(i, { name: e.target.value })}
              />
              {steps.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Employee</Label>
              <Select value={step.employee} onValueChange={(v) => updateStep(i, { employee: v ?? "" })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick an employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employeesQuery.data?.employees.map((emp) => (
                    <SelectItem key={emp.name} value={emp.name}>
                      {emp.name} ({emp.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Objective</Label>
              <Textarea
                placeholder="Use {{param}} for values passed at run time, e.g. Research {{topic}}"
                value={step.objective}
                onChange={(e) => updateStep(i, { objective: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Deliverable filename (optional)</Label>
              <Input
                placeholder="brief.md"
                value={step.deliverable}
                onChange={(e) => updateStep(i, { deliverable: e.target.value })}
              />
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setSteps((prev) => [...prev, emptyStep(prev.length)])}
        >
          <Plus className="size-3.5" /> Add step
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
          />
          Require human approval after the last step
        </label>

        {requireApproval && (
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="max-attempts" className="shrink-0">
              Max retries on reject
            </Label>
            <Input
              id="max-attempts"
              type="number"
              min={0}
              className="w-20"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      {createMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(createMutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? "Saving…" : "Generate & save YAML"}
        </Button>
      </DialogFooter>
    </div>
  );
}
