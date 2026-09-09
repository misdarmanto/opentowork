import { verifyPassword } from "@open-work/core";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { apiLogger } from "@/lib/server/logger";

// A real scrypt hash of a password nobody will ever type - verified against
// on every login attempt for an email that doesn't exist, so a missing user
// takes the same ~100ms scrypt cost as a wrong password. Without this, the
// two cases were distinguishable by response latency even though they
// return an identical error message and status.
const DUMMY_HASH =
  "0dd58fca3e3ef10d6dc2cca3065f8772:680405be910516c9315f7f04be4f42d1de26a86cfc9f8a1125f329722c0d560a87c94370811dfca524dc3b5854a63d11589c99f14d8aeea2e8ec2d748a337406";

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = getStore().findUserByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    // Same generic message, same latency, whether the email doesn't exist
    // or the password is wrong - a distinct response (in content or timing)
    // would let an attacker enumerate which emails are registered.
    if (!user || !valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const { token, expiresAt } = createSessionToken(user.id);
    const response = NextResponse.json({ email: user.email });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return response;
  } catch (err) {
    apiLogger.error("request failed", { route: "/api/auth/login", err });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
