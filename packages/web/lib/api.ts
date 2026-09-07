import type { Connector, Employee, ExecutionState, Skill, Workflow } from "@open-work/core";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request to ${url} failed with ${res.status}`);
  return body as T;
}

export interface RunRow {
  id: string;
  orgId: string;
  workflowName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalCost: number | null;
  errorMessage: string | null;
  params: string | null;
}

export interface StepRow {
  id: string;
  runId: string;
  stepName: string;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  output: string | null;
  recordedAt: string;
}

export interface ApprovalRow {
  id: string;
  runId: string;
  stepName: string;
  status: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

export const api = {
  listWorkflows: () => request<{ workflows: Workflow[] }>("/api/workflows"),
  listEmployees: () => request<{ employees: Employee[] }>("/api/employees"),
  listRuns: () => request<{ runs: RunRow[] }>("/api/runs"),
  listApprovals: () => request<{ pending: ApprovalRow[] }>("/api/approvals"),
  getRun: (id: string) =>
    request<{ run: RunRow; steps: StepRow[]; pendingApproval?: ApprovalRow }>(`/api/runs/${id}`),
  triggerRun: (workflow: string, params: Record<string, string>) =>
    request<{ state: ExecutionState }>("/api/runs", {
      method: "POST",
      body: JSON.stringify({ workflow, params }),
    }),
  approveRun: (id: string) => request<{ state: ExecutionState }>(`/api/runs/${id}/approve`, { method: "POST" }),
  rejectRun: (id: string) => request<{ state: ExecutionState }>(`/api/runs/${id}/reject`, { method: "POST" }),
  resumeRun: (id: string) => request<{ state: ExecutionState }>(`/api/runs/${id}/resume`, { method: "POST" }),
  createWorkflow: (input: unknown) =>
    request<{ workflow: Workflow; yamlText: string }>("/api/workflows", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listConnectors: () => request<{ connectors: Connector[] }>("/api/connectors"),
  createConnector: (input: unknown) =>
    request<{ connector: Connector; yamlText: string }>("/api/connectors", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listSkills: () => request<{ skills: Skill[] }>("/api/skills"),
  createSkill: (input: unknown) =>
    request<{ skill: Skill; yamlText: string }>("/api/skills", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createEmployee: (input: unknown) =>
    request<{ employee: Employee; yamlText: string }>("/api/employees", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
