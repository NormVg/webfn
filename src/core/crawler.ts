import { XMLParser } from "fast-xml-parser";

import { canonicalizeUrl, isInternalUrl, isLikelyPageUrl } from "../lib/url.js";
import { withBrowserSession } from "./browser.js";
import { fetchPageSnapshot } from "./fetcher.js";
import { fetchText } from "./http.js";
import type { BrowserLaunchOptions, BrowserRunInfo } from "./browser.js";
import type { CrawlPage, CrawlResult, PageSnapshot } from "./types.js";

type CrawlMode = "auto" | "links" | "sitemap";

type CrawlOptions = {
  browser: BrowserLaunchOptions;
  maxDepth: number;
  maxPages: number;
  mode: CrawlMode;
  timeoutMs: number;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

function arrayify<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

async function discoverRobotsSitemaps(rootUrl: string, timeoutMs: number) {
  const origin = new URL(rootUrl).origin;
  const candidates = new Set<string>([`${origin}/sitemap.xml`]);

  try {
    const robots = await fetchText(`${origin}/robots.txt`, { timeoutMs });
    for (const line of robots.text.split(/\r?\n/)) {
      if (line.toLowerCase().startsWith("sitemap:")) {
        const sitemap = line.slice("sitemap:".length).trim();
        const normalized = canonicalizeUrl(sitemap);

        if (normalized) {
          candidates.add(normalized);
        }
      }
    }
  } catch {
    // Ignore missing robots.txt files.
  }

  return Array.from(candidates);
}

function extractSitemapUrls(payload: unknown) {
  const urls = new Set<string>();
  const nestedSitemaps = new Set<string>();

  if (!payload || typeof payload !== "object") {
    return { nestedSitemaps, urls };
  }

  const record = payload as {
    sitemapindex?: {
      sitemap?: Array<{ loc?: string }> | { loc?: string };
    };
    urlset?: {
      url?: Array<{ loc?: string }> | { loc?: string };
    };
  };

  for (const entry of arrayify(record.urlset?.url)) {
    const normalized = canonicalizeUrl(entry.loc ?? "");
    if (normalized) {
      urls.add(normalized);
    }
  }

  for (const entry of arrayify(record.sitemapindex?.sitemap)) {
    const normalized = canonicalizeUrl(entry.loc ?? "");
    if (normalized) {
      nestedSitemaps.add(normalized);
    }
  }

  return { nestedSitemaps, urls };
}

async function discoverSitemapUrls(rootUrl: string, timeoutMs: number) {
  const queue = await discoverRobotsSitemaps(rootUrl, timeoutMs);
  const visited = new Set<string>();
  const urls = new Set<string>();

  while (queue.length > 0 && visited.size < 10 && urls.size < 2_000) {
    const next = queue.shift();

    if (!next || visited.has(next)) {
      continue;
    }

    visited.add(next);

    try {
      const response = await fetchText(next, {
        headers: {
          Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8"
        },
        timeoutMs
      });
      const parsed = xmlParser.parse(response.text);
      const extracted = extractSitemapUrls(parsed);

      extracted.urls.forEach((url) => {
        if (isLikelyPageUrl(url) && isInternalUrl(url, rootUrl)) {
          urls.add(url);
        }
      });
      extracted.nestedSitemaps.forEach((url) => queue.push(url));
    } catch {
      // Ignore invalid or missing sitemaps and fall back to link crawling when needed.
    }
  }

  return Array.from(urls);
}

function pushCrawlPage(
  pages: CrawlPage[],
  next: { depth: number; discoveredFrom: string | null; source: CrawlPage["source"] },
  snapshot: PageSnapshot
) {
  pages.push({
    depth: next.depth,
    description: snapshot.description,
    discoveredFrom: next.discoveredFrom,
    error: null,
    finalUrl: snapshot.finalUrl,
    requestedUrl: snapshot.requestedUrl,
    source: next.source,
    status: snapshot.status,
    title: snapshot.title
  });
}

function enqueueInternalLinks(
  queue: Array<{ depth: number; discoveredFrom: string | null; source: CrawlPage["source"]; url: string }>,
  queued: Set<string>,
  seen: Set<string>,
  next: { depth: number },
  maxDepth: number,
  snapshot: PageSnapshot
) {
  if (next.depth >= maxDepth) {
    return;
  }

  for (const link of snapshot.links) {
    if (!link.internal || !isLikelyPageUrl(link.href)) {
      continue;
    }

    const candidate = canonicalizeUrl(link.href);

    if (!candidate || seen.has(candidate) || queued.has(candidate)) {
      continue;
    }

    queued.add(candidate);
    queue.push({
      depth: next.depth + 1,
      discoveredFrom: snapshot.finalUrl,
      source: "links",
      url: candidate
    });
  }
}

function pushCrawlError(
  pages: CrawlPage[],
  next: { depth: number; discoveredFrom: string | null; source: CrawlPage["source"] },
  normalizedUrl: string,
  error: unknown
) {
  pages.push({
    depth: next.depth,
    description: null,
    discoveredFrom: next.discoveredFrom,
    error: error instanceof Error ? error.message : String(error),
    finalUrl: normalizedUrl,
    requestedUrl: normalizedUrl,
    source: next.source,
    status: null,
    title: null
  });
}

export async function crawlSite(rootUrl: string, options: CrawlOptions): Promise<CrawlResult> {
  const normalizedRoot = canonicalizeUrl(rootUrl);

  if (!normalizedRoot) {
    throw new Error(`Invalid URL: ${rootUrl}`);
  }

  const startedAt = new Date().toISOString();
  const sitemapUrls = options.mode !== "links" ? await discoverSitemapUrls(normalizedRoot, options.timeoutMs) : [];
  const useSitemap = options.mode !== "links" && sitemapUrls.length > 0;

  if (options.mode === "sitemap" && sitemapUrls.length === 0) {
    throw new Error(`No sitemap URLs were discovered for ${normalizedRoot}`);
  }

  const strategy: CrawlResult["strategy"] = useSitemap ? "sitemap" : "links";
  const queue: Array<{ depth: number; discoveredFrom: string | null; source: CrawlPage["source"]; url: string }> =
    useSitemap
      ? sitemapUrls.slice(0, options.maxPages).map((url) => ({
          depth: 0,
          discoveredFrom: normalizedRoot,
          source: "sitemap" as const,
          url
        }))
      : [{ depth: 0, discoveredFrom: null, source: "links" as const, url: normalizedRoot }];
  const seen = new Set<string>();
  const queued = new Set(queue.map((item) => item.url));
  const pages: CrawlPage[] = [];
  let browserRuntime: BrowserRunInfo | null = null;

  await withBrowserSession(options.browser, async ({ page, runtime }) => {
    browserRuntime = runtime;

    while (queue.length > 0 && pages.length < options.maxPages) {
      const next = queue.shift();

      if (!next) {
        break;
      }

      const normalized = canonicalizeUrl(next.url);

      if (!normalized || seen.has(normalized) || !isLikelyPageUrl(normalized)) {
        continue;
      }

      seen.add(normalized);

      try {
        const snapshot = await fetchPageSnapshot(page, normalized, {
          browser: runtime,
          delayMs: options.browser.delayMs,
          timeoutMs: options.timeoutMs,
          waitUntil: "domcontentloaded"
        });
        pushCrawlPage(pages, next, snapshot);

        if (strategy === "links") {
          enqueueInternalLinks(queue, queued, seen, next, options.maxDepth, snapshot);
        }
      } catch (error: unknown) {
        pushCrawlError(pages, next, normalized, error);
      }
    }
  });

  if (!browserRuntime) {
    throw new Error("Browser runtime was not resolved.");
  }

  return {
    browser: browserRuntime,
    finishedAt: new Date().toISOString(),
    maxDepth: options.maxDepth,
    maxPages: options.maxPages,
    pages,
    rootUrl: normalizedRoot,
    sitemapUrls,
    startedAt,
    strategy
  };
}
