"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function NewWorkflowPage() {
  const router = useRouter();
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
    onSuccess: (data) => setSavedYaml(data.yamlText),
  });

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const canSubmit = name.trim().length > 0 && steps.every((s) => s.employee && s.objective.trim());

  if (savedYaml) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Workflow saved</h1>
        <Alert>
          <AlertDescription>
            Saved to <code className="font-mono">config/workflows/{name}.yaml</code>. This is a
            real file - open it in your editor, commit it to git, or edit it by hand any time.
          </AlertDescription>
        </Alert>
        <Card>
          <CardContent className="pt-6">
            <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs">{savedYaml}</pre>
          </CardContent>
        </Card>
        <Button className="self-start" onClick={() => router.push("/workflows")}>
          Go to Workflows <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build a new workflow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick employees per step, set an objective, generate the same YAML you'd hand-write.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
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
            <Input
              id="wf-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Steps (run in order)</h2>
        {steps.map((step, i) => (
          <Card key={i}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm">
                <Input
                  className="h-7 w-48 font-medium"
                  value={step.name}
                  onChange={(e) => updateStep(i, { name: e.target.value })}
                />
              </CardTitle>
              {steps.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
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
                  placeholder='Use {{param}} for values passed at run time, e.g. Research {{topic}}'
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
            </CardContent>
          </Card>
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

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
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
        </CardContent>
      </Card>

      {createMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(createMutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <Button
        className="self-start"
        disabled={!canSubmit || createMutation.isPending}
        onClick={() => createMutation.mutate()}
      >
        {createMutation.isPending ? "Saving…" : "Generate & save YAML"}
      </Button>
    </div>
  );
}
