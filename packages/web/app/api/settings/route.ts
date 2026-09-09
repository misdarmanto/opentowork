import { ALL_PROVIDERS, type Provider } from "@open-work/core";
import { NextResponse } from "next/server";
import { addCustomModel, clearApiKey, getSettingsView, removeCustomModel, setApiKey } from "@/lib/server/settings";
import { apiLogger } from "@/lib/server/logger";

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (ALL_PROVIDERS as readonly string[]).includes(value);
}

export async function GET() {
  try {
    return NextResponse.json(getSettingsView());
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/settings", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

type SettingsRequest =
  | { action: "setApiKey"; provider: Provider; apiKey: string }
  | { action: "clearApiKey"; provider: Provider }
  | { action: "addCustomModel"; provider: Provider; name: string }
  | { action: "removeCustomModel"; provider: Provider; name: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SettingsRequest;
    if (!isProvider(body.provider)) {
      return NextResponse.json({ error: `Invalid provider "${body.provider}"` }, { status: 400 });
    }

    switch (body.action) {
      case "setApiKey":
        if (!body.apiKey.trim()) return NextResponse.json({ error: "API key cannot be empty" }, { status: 400 });
        setApiKey(body.provider, body.apiKey.trim());
        break;
      case "clearApiKey":
        clearApiKey(body.provider);
        break;
      case "addCustomModel":
        if (!body.name.trim()) return NextResponse.json({ error: "Model name cannot be empty" }, { status: 400 });
        addCustomModel(body.provider, body.name.trim());
        break;
      case "removeCustomModel":
        removeCustomModel(body.provider, body.name);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json(getSettingsView());
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/settings", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
