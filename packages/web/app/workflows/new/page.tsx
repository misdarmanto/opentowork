"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-lg font-semibold">Build a new workflow</h1>

      {savedYaml ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Saved to <code>config/workflows/{name}.yaml</code>. This is a real file — open it in your editor, commit
            it to git, or edit it by hand any time.
          </p>
          <pre className="text-xs bg-black/5 dark:bg-white/5 rounded-md p-3 overflow-x-auto">{savedYaml}</pre>
          <button type="button" className="self-start text-sm underline" onClick={() => router.push("/workflows")}>
            Go to Workflows →
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Workflow name
            <input
              className="border border-black/15 dark:border-white/20 rounded px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value.trim().replace(/\s+/g, "-"))}
              placeholder="my-workflow"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Description (optional)
            <input
              className="border border-black/15 dark:border-white/20 rounded px-2 py-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold opacity-70">Steps (run in order)</h2>
            {steps.map((step, i) => (
              <div key={i} className="border border-black/10 dark:border-white/15 rounded-md p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <input
                    className="border border-black/15 dark:border-white/20 rounded px-2 py-1 text-sm font-medium"
                    value={step.name}
                    onChange={(e) => updateStep(i, { name: e.target.value })}
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      className="text-xs opacity-60 hover:opacity-100"
                      onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <select
                  className="border border-black/15 dark:border-white/20 rounded px-2 py-1 text-sm"
                  value={step.employee}
                  onChange={(e) => updateStep(i, { employee: e.target.value })}
                >
                  <option value="">Pick an employee…</option>
                  {employeesQuery.data?.employees.map((emp) => (
                    <option key={emp.name} value={emp.name}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>

                <textarea
                  className="border border-black/15 dark:border-white/20 rounded px-2 py-1 text-sm"
                  placeholder="Objective — use {{param}} for values passed at run time, e.g. Research {{topic}}"
                  value={step.objective}
                  onChange={(e) => updateStep(i, { objective: e.target.value })}
                  rows={2}
                />

                <input
                  className="border border-black/15 dark:border-white/20 rounded px-2 py-1 text-sm"
                  placeholder="Deliverable filename (optional), e.g. brief.md"
                  value={step.deliverable}
                  onChange={(e) => updateStep(i, { deliverable: e.target.value })}
                />
              </div>
            ))}
            <button
              type="button"
              className="self-start text-sm underline"
              onClick={() => setSteps((prev) => [...prev, emptyStep(prev.length)])}
            >
              + Add step
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
            Require human approval after the last step
          </label>

          {requireApproval && (
            <label className="flex items-center gap-2 text-sm">
              Max retries on reject
              <input
                type="number"
                min={0}
                className="border border-black/15 dark:border-white/20 rounded px-2 py-1 w-20"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
              />
            </label>
          )}

          {createMutation.isError && (
            <p className="text-sm text-red-700 dark:text-red-400">{(createMutation.error as Error).message}</p>
          )}

          <button
            type="button"
            disabled={!canSubmit || createMutation.isPending}
            className="self-start text-sm bg-black text-white dark:bg-white dark:text-black rounded px-4 py-2 disabled:opacity-50"
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Saving…" : "Generate & save YAML"}
          </button>
        </>
      )}
    </div>
  );
}
