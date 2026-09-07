"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SkillForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const connectorsQuery = useQuery({ queryKey: ["connectors"], queryFn: api.listConnectors });

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [connectors, setConnectors] = useState<string[]>([]);
  const [savedYaml, setSavedYaml] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.createSkill({ name, instructions, connectors }),
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
            Saved to <code className="font-mono">config/skills/{name}.yaml</code>. Add{" "}
            <code className="font-mono">{name}</code> to any employee's <code className="font-mono">skills:</code>{" "}
            list to attach it.
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
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-instructions">Instructions</Label>
          <Textarea
            id="s-instructions"
            rows={5}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Prefer primary sources. Always capture a URL per claim…"
          />
        </div>

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
          {createMutation.isPending ? "Saving…" : "Save skill"}
        </Button>
      </DialogFooter>
    </div>
  );
}
