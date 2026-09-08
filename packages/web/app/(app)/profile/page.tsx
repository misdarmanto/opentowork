import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getSessionUser } from "@/lib/server/auth";

export default async function ProfilePage() {
  // Belt and suspenders with proxy.ts/app/(app)/layout.tsx's own checks -
  // this page needs the email to render regardless, so it reads the
  // session itself rather than trusting it was already validated upstream.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account for this Open Work instance.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Account</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Change password</h2>
          <p className="text-sm text-muted-foreground">
            Takes effect immediately - you stay signed in on this device, other sessions are unaffected.
          </p>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
