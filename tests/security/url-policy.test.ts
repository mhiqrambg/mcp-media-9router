import { describe, expect, it } from "vitest";
import { MediaError } from "../../src/domain/errors.js";
import { assertPublicWebUrl } from "../../src/security/url-policy.js";

describe("assertPublicWebUrl", () => {
  it("accepts a public HTTPS URL", () => {
    expect(assertPublicWebUrl("https://example.com/article").hostname).toBe("example.com");
  });

  it.each([
    "file:///etc/passwd",
    "https://localhost/private",
    "http://127.0.0.1:8080",
    "http://[::1]:8080",
    "http://[fd00::1]:8080",
    "https://169.254.169.254/latest/meta-data",
    "https://user:password@example.com",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => assertPublicWebUrl(url)).toThrow(MediaError);
  });
});
