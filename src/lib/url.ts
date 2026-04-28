const SKIPPED_EXTENSIONS = /\.(?:7z|avi|css|csv|gif|ico|jpeg|jpg|js|json|mov|mp3|mp4|pdf|png|rss|svg|tar|txt|webm|webp|xml|zip)$/i;

export function canonicalizeUrl(input: string, base?: string) {
  try {
    const url = base ? new URL(input, base) : new URL(input);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";

    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
      url.port = "";
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function isInternalUrl(candidate: string, rootUrl: string) {
  try {
    return new URL(candidate).origin === new URL(rootUrl).origin;
  } catch {
    return false;
  }
}

export function isLikelyPageUrl(candidate: string) {
  try {
    const url = new URL(candidate);
    return !SKIPPED_EXTENSIONS.test(url.pathname);
  } catch {
    return false;
  }
}
