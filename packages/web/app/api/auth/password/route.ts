import { hashPassword, verifyPassword } from "@open-work/core";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { apiLogger } from "@/lib/server/logger";

export async function PUT(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const store = getStore();
    // findUserById, not the session's own claim - never trust a client-supplied
    // password hash comparison against anything but a value read fresh from the store.
    const user = store.findUserById(sessionUser.id);
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const currentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentValid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

    const passwordHash = await hashPassword(newPassword);
    store.upsertUser({ id: user.id, email: user.email, passwordHash });

    return NextResponse.json({ ok: true });
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/auth/password", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
