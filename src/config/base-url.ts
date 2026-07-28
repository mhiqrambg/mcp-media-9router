export function isAllowedNineRouterBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ||
      (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}

export const nineRouterBaseUrlMessage = "must use HTTPS, or http://localhost with any port for a local 9router server";
