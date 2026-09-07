"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ConnectorForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<"mcp" | "custom">("mcp");
  const [command, setCommand] = useState("npx");
  const [args, setArgs] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [savedYaml, setSavedYaml] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createConnector({
        name,
        type,
        ...(type === "mcp" ? { command, args: args.split(/\s+/).filter(Boolean) } : { path: customPath }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
      setSavedYaml(data.yamlText);
    },
  });

  const canSubmit = name.trim().length > 0 && (type === "mcp" ? command.trim().length > 0 : customPath.trim().length > 0);

  if (savedYaml) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Saved to <code className="font-mono">config/connectors/{name}.yaml</code>. Reference it from any
            employee with <code className="font-mono">{`{type: connector, connector: ${name}}`}</code>.
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
          <Label htmlFor="c-name">Connector name</Label>
          <Input
            id="c-name"
            value={name}
            onChange={(e) => setName(e.target.value.trim().replace(/\s+/g, "-"))}
            placeholder="duckduckgo"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType((v as "mcp" | "custom") ?? "mcp")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcp">MCP server</SelectItem>
              <SelectItem value="custom">Custom JS/TS function</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {type === "mcp" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-command">Command</Label>
              <Input id="c-command" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-args">Args (space-separated)</Label>
              <Input
                id="c-args"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="-y duckduckgo-mcp-server"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-path">Path to the tool's .js/.ts file</Label>
            <Input
              id="c-path"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="./tools/verify-source.js"
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
          {createMutation.isPending ? "Saving…" : "Save connector"}
        </Button>
      </DialogFooter>
    </div>
  );
}
