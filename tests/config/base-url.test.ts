import { describe, expect, it } from "vitest";
import { isAllowedNineRouterBaseUrl } from "../../src/config/base-url.js";

describe("isAllowedNineRouterBaseUrl", () => {
  it.each([
    "https://9router.mibp.me",
    "https://9router.mibp.me/v1",
    "http://localhost:20128",
    "http://localhost:20128/",
    "http://localhost:8080",
    "http://localhost",
  ])("accepts %s", (baseUrl) => {
    expect(isAllowedNineRouterBaseUrl(baseUrl)).toBe(true);
  });

  it.each([
    "http://9router.mibp.me",
    "http://localhost:20128.evil.example",
    "https://",
  ])("rejects %s", (baseUrl) => {
    expect(isAllowedNineRouterBaseUrl(baseUrl)).toBe(false);
  });
});
