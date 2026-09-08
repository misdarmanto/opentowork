"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function login(email: string, password: string): Promise<{ email: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Login failed");
  return body;
}

/**
 * Reads ?next= in its own component wrapped in Suspense - Next.js requires
 * any useSearchParams() call to be inside a Suspense boundary during static
 * export (same fix used for the workflows page's ?new=1 and the customize
 * page's ?tab= shortcuts). Resolves it inside an effect with a one-shot ref
 * guard, not directly during render: onResolved is a fresh function every
 * parent render (not memoized), so calling it during render - and including
 * it in an effect's dependency array without the guard - both risk
 * "Cannot update a component while rendering a different component" /
 * an infinite update loop, the same bug already hit and fixed twice
 * elsewhere in this app.
 */
function NextPathFromQueryParam({ onResolved }: { onResolved: (path: string) => void }) {
  const searchParams = useSearchParams();
  const firedRef = useRef(false);

  useEffect(() => {
    const next = searchParams.get("next");
    if (!firedRef.current && next && next.startsWith("/")) {
      firedRef.current = true;
      onResolved(next);
    }
  }, [searchParams, onResolved]);

  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [redirectTo, setRedirectTo] = useState("/");

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => {
      router.push(redirectTo);
      router.refresh();
    },
  });

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <Suspense fallback={null}>
        <NextPathFromQueryParam onResolved={setRedirectTo} />
      </Suspense>

      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            OW
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Sign in to Open Work</h1>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) loginMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {loginMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>{(loginMutation.error as Error).message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={!canSubmit || loginMutation.isPending} className="w-full">
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
