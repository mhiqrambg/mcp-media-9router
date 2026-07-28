import { MediaError } from "../domain/errors.js";

const privateIpv4Pattern = /^(?:0|10|127)\.|^169\.254\.|^172\.(?:1[6-9]|2\d|3[0-1])\.|^192\.168\./;

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

export function assertPublicWebUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MediaError("INVALID_URL", "url must be an absolute HTTP or HTTPS URL", false);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new MediaError("INVALID_URL", "url must use the HTTP or HTTPS scheme", false);
  }
  if (url.username || url.password) {
    throw new MediaError("INVALID_URL", "url must not include credentials", false);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    isPrivateIpv6(hostname) ||
    hostname === "0.0.0.0" ||
    privateIpv4Pattern.test(hostname)
  ) {
    throw new MediaError("INVALID_URL", "url must not target a local or private network", false);
  }
  return url;
}
