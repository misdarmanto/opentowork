import { NextResponse } from "next/server";
import { buildConnectorFromForm, listConnectors, saveConnector, type ConnectorFormInput } from "@/lib/server/workflows";

export async function GET() {
  try {
    const connectors = listConnectors();
    return NextResponse.json({ connectors });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as ConnectorFormInput;
    const { connector, yamlText } = buildConnectorFromForm(input);
    saveConnector(connector, yamlText);
    return NextResponse.json({ connector, yamlText }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
