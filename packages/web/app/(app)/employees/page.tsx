"use client";

import { useState } from "react";
import { Building2, Cpu, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Employee } from "@open-work/core";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeForm } from "@/components/forms/employee-form";

/** "content-researcher-deepseek" -> "CR" - employee names are hyphenated slugs, not human names. */
function initials(name: string): string {
  const parts = name.split(/[-_\s]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

type DialogState = { mode: "create" } | { mode: "edit"; employee: Employee } | null;

export default function EmployeesPage() {
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: api.listEmployees });
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [formKey, setFormKey] = useState(0);

  const openCreate = () => {
    setFormKey((k) => k + 1);
    setDialogState({ mode: "create" });
  };

  const openEdit = (employee: Employee) => {
    setFormKey((k) => k + 1);
    setDialogState({ mode: "edit", employee });
  };

  const close = () => setDialogState(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defined in <code className="rounded bg-muted px-1 py-0.5 text-xs">config/employees/*.yaml</code> - pick
            a provider/model, attach skills and connectors, use them as steps in any workflow.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> New employee
        </Button>
      </div>

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogState?.mode === "edit" ? dialogState.employee.name : "Build a new employee"}</DialogTitle>
            <DialogDescription>
              Persona, model, skills and connectors - the same YAML you'd hand-write in{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">config/employees/</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden pr-2">
            {dialogState && (
              <EmployeeForm
                key={formKey}
                employee={dialogState.mode === "edit" ? dialogState.employee : undefined}
                onCreated={close}
                onDeleted={close}
                onCancel={close}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {employeesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employeesQuery.data?.employees.map((emp) => {
            const tags = [...emp.skills, ...emp.tools.map((t) => (t.type === "connector" ? t.connector : t.name))];
            return (
              <button
                key={emp.name}
                type="button"
                onClick={() => openEdit(emp)}
                className="text-left"
              >
                <Card className="gap-0 overflow-hidden py-0 transition-colors hover:bg-muted/50">
                  <div className="h-14 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" />
                  <CardContent className="flex flex-col items-center px-4 pt-0 pb-4 text-center">
                    <span className="-mt-8 flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-card bg-primary text-lg font-semibold text-primary-foreground">
                      {initials(emp.name)}
                    </span>
                    <h2 className="mt-2 font-semibold">{emp.name}</h2>
                    <p className="text-sm text-muted-foreground">{emp.role}</p>
                    {emp.department && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="size-3" />
                        {emp.department}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Cpu className="size-3" />
                      {emp.provider} / {emp.model}
                    </p>

                    {emp.description && (
                      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{emp.description}</p>
                    )}

                    {tags.length > 0 && (
                      <div className="mt-3 flex w-full flex-wrap justify-center gap-1.5 border-t border-border pt-3">
                        {tags.map((tag, i) => (
                          <Badge key={`${tag}-${i}`} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </button>
            );
          })}
          {employeesQuery.data?.employees.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">No employees yet.</CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
