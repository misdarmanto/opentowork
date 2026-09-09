import {
  ALL_PROVIDERS,
  readSettingsFile,
  writeSettingsFile,
  type Provider,
  type Settings,
} from "@open-work/core";
import { STATE_DIR } from "./paths";

export interface ProviderStatus {
  provider: Provider;
  /** Whether a key is set via the UI, an env var, or neither. */
  configured: boolean;
  /** Where the active key comes from - the UI-set key always wins if both are present. */
  source: "settings" | "env" | "none";
  /** Last 4 characters only - the real value never round-trips back to the client once saved. */
  last4?: string;
}

const ENV_VAR_BY_PROVIDER: Record<Provider, string | undefined> = {
  anthropic: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  openai: undefined,
  google: undefined,
};

export interface SettingsView {
  providers: ProviderStatus[];
  customModels: Settings["customModels"];
}

/** Never returns a real key value - only whether one is set and where it came from. */
export function getSettingsView(): SettingsView {
  const settings = readSettingsFile(STATE_DIR);

  const providers: ProviderStatus[] = ALL_PROVIDERS.map((provider) => {
    const uiKey = settings.apiKeys[provider];
    if (uiKey) {
      return { provider, configured: true, source: "settings", last4: uiKey.slice(-4) };
    }
    const envVar = ENV_VAR_BY_PROVIDER[provider];
    const envKey = envVar ? process.env[envVar] : undefined;
    if (envKey) {
      return { provider, configured: true, source: "env", last4: envKey.slice(-4) };
    }
    return { provider, configured: false, source: "none" };
  });

  return { providers, customModels: settings.customModels };
}

export function setApiKey(provider: Provider, apiKey: string): void {
  const settings = readSettingsFile(STATE_DIR);
  settings.apiKeys[provider] = apiKey;
  writeSettingsFile(STATE_DIR, settings);
}

export function clearApiKey(provider: Provider): void {
  const settings = readSettingsFile(STATE_DIR);
  delete settings.apiKeys[provider];
  writeSettingsFile(STATE_DIR, settings);
}

export function addCustomModel(provider: Provider, name: string): void {
  const settings = readSettingsFile(STATE_DIR);
  if (settings.customModels.some((m) => m.provider === provider && m.name === name)) return;
  settings.customModels.push({ provider, name });
  writeSettingsFile(STATE_DIR, settings);
}

export function removeCustomModel(provider: Provider, name: string): void {
  const settings = readSettingsFile(STATE_DIR);
  settings.customModels = settings.customModels.filter((m) => !(m.provider === provider && m.name === name));
  writeSettingsFile(STATE_DIR, settings);
}
