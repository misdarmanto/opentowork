"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Skill } from "@open-work/core";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownField } from "@/components/markdown-field";

export function SkillForm({
  skill,
  onCreated,
  onCancel,
}: {
  /** When set, edits this existing skill instead of creating a new one - its name can't be changed here. */
  skill?: Skill;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const isEditing = skill !== undefined;
  const queryClient = useQueryClient();
  const connectorsQuery = useQuery({ queryKey: ["connectors"], queryFn: api.listConnectors });

  const [name, setName] = useState(skill?.name ?? "");
  const [instructions, setInstructions] = useState(skill?.instructions ?? "");
  const [connectors, setConnectors] = useState<string[]>(
    skill?.tools.filter((t) => t.type === "connector").map((t) => t.connector) ?? [],
  );
  const [savedYaml, setSavedYaml] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      isEditing ? api.updateSkill(skill.name, { name, instructions, connectors }) : api.createSkill({ name, instructions, connectors }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      setSavedYaml(data.yamlText);
    },
  });

  const toggleConnector = (connectorName: string) => {
    setConnectors((prev) =>
      prev.includes(connectorName) ? prev.filter((c) => c !== connectorName) : [...prev, connectorName],
    );
  };

  const canSubmit = name.trim().length > 0 && instructions.trim().length > 0;

  if (savedYaml) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            {isEditing ? (
              <>
                Saved changes to <code className="font-mono">config/skills/{name}.yaml</code>.
              </>
            ) : (
              <>
                Saved to <code className="font-mono">config/skills/{name}.yaml</code>. Add{" "}
                <code className="font-mono">{name}</code> to any employee's <code className="font-mono">skills:</code>{" "}
                list to attach it.
              </>
            )}
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
          <Label htmlFor="s-name">Skill name</Label>
          <Input
            id="s-name"
            value={name}
            onChange={(e) => setName(e.target.value.trim().replace(/\s+/g, "-"))}
            placeholder="web-research"
            disabled={isEditing}
          />
        </div>

        <MarkdownField
          id="s-instructions"
          value={instructions}
          onChange={setInstructions}
          rows={8}
          placeholder="Prefer primary sources. Always capture a URL per claim…"
        />

        {connectorsQuery.data?.connectors && connectorsQuery.data.connectors.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Tools this skill contributes (optional)</Label>
            <div className="flex flex-col gap-2">
              {connectorsQuery.data.connectors.map((c) => (
                <label key={c.name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={connectors.includes(c.name)}
                    onChange={() => toggleConnector(c.name)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {saveMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(saveMutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? "Saving…" : isEditing ? "Save changes" : "Save skill"}
        </Button>
      </DialogFooter>
    </div>
  );
}
