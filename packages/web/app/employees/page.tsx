"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeForm } from "@/components/forms/employee-form";

export default function EmployeesPage() {
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: api.listEmployees });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const openDialog = () => {
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

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
        <Button onClick={openDialog}>
          <Plus className="size-4" /> New employee
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Build a new employee</DialogTitle>
            <DialogDescription>
              Persona, model, skills and connectors - the same YAML you'd hand-write in{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">config/employees/</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <EmployeeForm
              key={formKey}
              onCreated={() => setDialogOpen(false)}
              onCancel={() => setDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {employeesQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {employeesQuery.data?.employees.map((emp) => (
            <Card key={emp.name}>
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-medium">{emp.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {emp.role}
                      {emp.department ? ` · ${emp.department}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {emp.provider} / {emp.model}
                  </Badge>
                </div>
                {emp.description && <p className="text-sm text-muted-foreground">{emp.description}</p>}
                {(emp.skills.length > 0 || emp.tools.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {emp.skills.map((s) => (
                      <Badge key={`skill-${s}`} variant="outline">
                        {s}
                      </Badge>
                    ))}
                    {emp.tools.map((t, i) => (
                      <Badge key={`tool-${i}`} variant="outline">
                        {t.type === "connector" ? t.connector : t.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
            </Card>
          ))}
          {employeesQuery.data?.employees.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">No employees yet.</CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
