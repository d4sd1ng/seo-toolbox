export function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  url.pathname = path;
  return url.toString();
}

export function hostnameOf(raw: string): string {
  return new URL(raw).hostname.replace(/^www\./, "");
}
