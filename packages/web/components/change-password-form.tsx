"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSuccess(false);
        if (canSubmit) mutation.mutate();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-current">Current password</Label>
        <Input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-new">New password</Label>
        <Input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-confirm">Confirm new password</Label>
        <Input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
      </div>

      {success && (
        <Alert>
          <AlertDescription>Password updated.</AlertDescription>
        </Alert>
      )}
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(mutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={!canSubmit || mutation.isPending} className="self-start">
        {mutation.isPending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
