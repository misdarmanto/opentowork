import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies a password against its own real hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("never stores the password in plain text in the hash output", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
  });

  it("produces a different hash each time (random salt), both still verifying", async () => {
    const hashA = await hashPassword("same password");
    const hashB = await hashPassword("same password");
    expect(hashA).not.toBe(hashB);
    expect(await verifyPassword("same password", hashA)).toBe(true);
    expect(await verifyPassword("same password", hashB)).toBe(true);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });
});
