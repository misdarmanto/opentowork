"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Provider } from "@open-work/core";
import { api } from "@/lib/api";
import { applyTheme, readStoredTheme, storeTheme, type ThemePreference } from "@/lib/theme";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Duplicated from @open-work/core's ALL_PROVIDERS rather than imported: this
 * file is a client component, and @open-work/core's single barrel export
 * re-exports the executor/store/tools modules too (SQLite, child_process),
 * which can't be bundled for the browser - same reason app/workflows/page.tsx
 * duplicates isHumanStep instead of importing it.
 */
const ALL_PROVIDERS: Provider[] = ["anthropic", "openai", "google", "deepseek"];
const IMPLEMENTED: Provider[] = ["anthropic", "deepseek"];
const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function ThemeSection() {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  const choose = (value: ThemePreference) => {
    setTheme(value);
    storeTheme(value);
    applyTheme(value);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-medium">Appearance</h2>
        <p className="text-sm text-muted-foreground">Applies immediately, stored per browser.</p>
      </CardHeader>
      <CardContent className="flex gap-2">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            type="button"
            variant={theme === value ? "default" : "outline"}
            onClick={() => choose(value)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function ApiKeyRow({ provider }: { provider: Provider }) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [draft, setDraft] = useState("");
  const implemented = IMPLEMENTED.includes(provider);
  const status = settingsQuery.data?.providers.find((p) => p.provider === provider);

  const setMutation = useMutation({
    mutationFn: () => api.setApiKey(provider, draft),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      setDraft("");
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.clearApiKey(provider),
    onSuccess: (data) => queryClient.setQueryData(["settings"], data),
  });

  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize">{provider}</span>
          {!implemented && (
            <Badge variant="outline" title="No LLMProvider implementation yet - see ROADMAP.md">
              not implemented yet
            </Badge>
          )}
        </div>
        {status?.configured && (
          <Badge variant="secondary">
            {status.source === "settings" ? "set here" : "from environment"} - ends in {status.last4}
          </Badge>
        )}
      </div>

      {implemented && (
        <div className="flex items-center gap-2">
          <Input
            type="password"
            placeholder={status?.configured ? "Enter a new key to replace it" : "sk-..."}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            disabled={!draft.trim() || setMutation.isPending}
            onClick={() => setMutation.mutate()}
          >
            Save
          </Button>
          {status?.source === "settings" && (
            <Button size="sm" variant="outline" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
              Remove
            </Button>
          )}
        </div>
      )}

      {(setMutation.isError || clearMutation.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {((setMutation.error ?? clearMutation.error) as Error).message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ApiKeysSection() {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-medium">Providers &amp; API keys</h2>
        <p className="text-sm text-muted-foreground">
          A key set here overrides the equivalent environment variable ({" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">DEEPSEEK_API_KEY</code>) for both the web app and
          the CLI - stored in <code className="rounded bg-muted px-1 py-0.5 text-xs">.open-work/settings.json</code>,
          never committed to git. The key itself is never sent back to the browser after saving.
        </p>
      </CardHeader>
      <CardContent>
        {ALL_PROVIDERS.map((provider) => (
          <ApiKeyRow key={provider} provider={provider} />
        ))}
      </CardContent>
    </Card>
  );
}

function CustomModelsSection() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [name, setName] = useState("");

  const addMutation = useMutation({
    mutationFn: () => api.addCustomModel(provider, name),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      setName("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (model: { provider: Provider; name: string }) => api.removeCustomModel(model.provider, model.name),
    onSuccess: (data) => queryClient.setQueryData(["settings"], data),
  });

  return (
    <Card>
      <CardHeader>
        <h2 className="font-medium">Custom models</h2>
        <p className="text-sm text-muted-foreground">
          A reference list for the employee builder - any model string already works in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">config/employees/*.yaml</code>, this just saves you
          retyping ones you use often.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={(v) => setProvider((v as Provider) ?? "anthropic")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="claude-opus-5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" disabled={!name.trim() || addMutation.isPending} onClick={() => addMutation.mutate()}>
            <Plus className="size-4" /> Add
          </Button>
        </div>

        {(settingsQuery.data?.customModels.length ?? 0) > 0 && (
          <div className="flex flex-col gap-1.5">
            {settingsQuery.data?.customModels.map((m) => (
              <div
                key={`${m.provider}:${m.name}`}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  <Badge variant="outline" className="mr-2">
                    {m.provider}
                  </Badge>
                  {m.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeMutation.mutate({ provider: m.provider, name: m.name })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Theme, providers, and API keys for this machine.</p>
      </div>

      <ThemeSection />
      <ApiKeysSection />
      <CustomModelsSection />
    </div>
  );
}
