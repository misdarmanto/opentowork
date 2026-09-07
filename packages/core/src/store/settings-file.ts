import fs from "node:fs";
import path from "node:path";
import { emptySettings, parseSettings, type Settings } from "../schema/settings.js";

/**
 * Settings (API keys, custom model list) live in a JSON file under the
 * runtime state dir (.open-work/), not config/ - unlike employees/workflows,
 * these are per-machine secrets/preferences, not something to git-commit or
 * review in a PR. Read by both the CLI and web's provider factory setup so
 * a key added through the web UI takes effect either way.
 */
function settingsFilePath(stateDir: string): string {
  return path.join(stateDir, "settings.json");
}

export function readSettingsFile(stateDir: string): Settings {
  const filePath = settingsFilePath(stateDir);
  if (!fs.existsSync(filePath)) return emptySettings();
  try {
    return parseSettings(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  } catch {
    // A corrupt or hand-edited settings.json shouldn't take down every run -
    // fall back to "nothing configured" (environment variables still work).
    return emptySettings();
  }
}

export function writeSettingsFile(stateDir: string, settings: Settings): void {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(settingsFilePath(stateDir), JSON.stringify(settings, null, 2));
}
