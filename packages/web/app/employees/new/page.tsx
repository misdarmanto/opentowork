"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const PROVIDERS = ["anthropic", "openai", "google", "deepseek"] as const;

export default function NewEmployeePage() {
  const router = useRouter();
  const connectorsQuery = useQuery({ queryKey: ["connectors"], queryFn: api.listConnectors });
  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: api.listSkills });

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [context, setContext] = useState("");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("anthropic");
  const [model, setModel] = useState("claude-sonnet-4");
  const [skills, setSkills] = useState<string[]>([]);
  const [connectors, setConnectors] = useState<string[]>([]);
  const [successCriteria, setSuccessCriteria] = useState("");
  const [savedYaml, setSavedYaml] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createEmployee({
        name,
        role,
        department: department || undefined,
        description: description || undefined,
        systemPrompt: systemPrompt || undefined,
        context: context || undefined,
        provider,
        model,
        skills,
        // Exclude connectors a selected skill already contributes - the UI
        // disables their checkboxes, but this guards against stale state
        // (e.g. a skill checked after its connector was already checked).
        connectors: connectors.filter((c) => !connectorsFromSelectedSkills.has(c)),
        successCriteria: successCriteria
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (data) => setSavedYaml(data.yamlText),
  });

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  // A tool this employee's own tools: and a selected skill both resolve to
  // the same name makes loadToolsForEmployee throw at run time (two tools
  // can't share a name in one LLM call) - so a connector already pulled in
  // by a selected skill can't also be picked directly here.
  const connectorsFromSelectedSkills = new Set(
    (skillsQuery.data?.skills ?? [])
      .filter((s) => skills.includes(s.name))
      .flatMap((s) => s.tools)
      .filter((t): t is Extract<typeof t, { type: "connector" }> => t.type === "connector")
      .map((t) => t.connector),
  );

  const canSubmit = name.trim().length > 0 && role.trim().length > 0 && model.trim().length > 0;

  if (savedYaml) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Employee saved</h1>
        <Alert>
          <AlertDescription>
            Saved to <code className="font-mono">config/employees/{name}.yaml</code>. Use{" "}
            <code className="font-mono">{name}</code> as a step's employee in any workflow.
          </AlertDescription>
        </Alert>
        <Card>
          <CardContent className="pt-6">
            <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs">{savedYaml}</pre>
          </CardContent>
        </Card>
        <Button className="self-start" onClick={() => router.push("/employees")}>
          Go to Employees <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build a new employee</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Persona, model, skills and connectors - the same YAML you'd hand-write in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">config/employees/</code>.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-name">Employee name</Label>
            <Input
              id="e-name"
              value={name}
              onChange={(e) => setName(e.target.value.trim().replace(/\s+/g, "-"))}
              placeholder="content-researcher"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-role">Role</Label>
            <Input id="e-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Researcher" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-department">Department (optional)</Label>
            <Input id="e-department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Content" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-description">Description (optional)</Label>
            <Textarea id="e-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider((v as (typeof PROVIDERS)[number]) ?? "anthropic")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-model">Model</Label>
            <Input id="e-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-system-prompt">System prompt (optional)</Label>
            <Textarea
              id="e-system-prompt"
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Free-form persona/instructions sent to the model verbatim."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-context">Reference context (optional)</Label>
            <Textarea
              id="e-context"
              rows={3}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Company style guide, product facts - always included in the system prompt."
            />
          </div>
        </CardContent>
      </Card>

      {(skillsQuery.data?.skills.length ?? 0) > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <Label>Skills</Label>
            {skillsQuery.data?.skills.map((s) => (
              <label key={s.name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={skills.includes(s.name)}
                  onChange={() => toggle(skills, setSkills, s.name)}
                />
                {s.name}
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {(connectorsQuery.data?.connectors.length ?? 0) > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <Label>Tools (connectors)</Label>
            {connectorsQuery.data?.connectors.map((c) => {
              const fromSkill = connectorsFromSelectedSkills.has(c.name);
              return (
                <label
                  key={c.name}
                  className={`flex items-center gap-2 text-sm ${fromSkill ? "text-muted-foreground" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={fromSkill || connectors.includes(c.name)}
                    disabled={fromSkill}
                    onChange={() => toggle(connectors, setConnectors, c.name)}
                  />
                  {c.name}
                  {fromSkill && " (already included by a selected skill)"}
                </label>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-1.5 pt-6">
          <Label htmlFor="e-success">Success criteria (one per line, optional)</Label>
          <Textarea
            id="e-success"
            rows={3}
            value={successCriteria}
            onChange={(e) => setSuccessCriteria(e.target.value)}
            placeholder={"output contains minimum 5 sources\neach claim has a URL"}
          />
        </CardContent>
      </Card>

      {createMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(createMutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <Button className="self-start" disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
        {createMutation.isPending ? "Saving…" : "Generate & save YAML"}
      </Button>
    </div>
  );
}
