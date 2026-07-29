import { describe, expect, it } from "vitest";
import { createProtectScript, createUnprotectScript } from "../src/credentials.js";

describe("Windows credential scripts", () => {
  it("loads System.Security before protecting an API key", () => {
    const script = createProtectScript("YzpcXGNyZWRlbnRpYWxzLmRhdA==");
    expect(script).toContain("LoadWithPartialName('System.Security')");
    expect(script).toContain("[Security.Cryptography.ProtectedData]::Protect");
  });

  it("loads System.Security before reading an API key", () => {
    const script = createUnprotectScript("YzpcXGNyZWRlbnRpYWxzLmRhdA==");
    expect(script).toContain("LoadWithPartialName('System.Security')");
    expect(script).toContain("[Security.Cryptography.ProtectedData]::Unprotect");
  });
});
