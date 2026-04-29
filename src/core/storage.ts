import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { hashText, slugify } from "../lib/text.js";
import { resolvePreferredUrl } from "../lib/url.js";
import type { BrowserRunInfo } from "./browser.js";
import type { CrawlResult, PageSnapshot, ScrapeResult, SearchResult } from "./types.js";

export type SavedFile = {
  label: string;
  path: string;
};

type FetchArtifactOptions = {
  frontmatter?: boolean;
  saveHtml?: boolean;
  saveJson?: boolean;
};

async function ensureParentDirectory(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeJson(filePath: string, data: unknown) {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, data: string) {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, data, "utf8");
}

/**
 * Build a clean, human-readable artifact path for a URL.
 * 
 * Structure: <outputDir>/sites/<hostname>/<path-slug>.md
 * Example:   data/sites/www.fool.com/investing-claude-agent-stocks.md
 */
function getUrlArtifactPath(outputDir: string, url: string, fallbackUrl?: string) {
  const artifactUrl = resolvePreferredUrl(url, fallbackUrl);
  const parsed = new URL(artifactUrl);
  const hostname = parsed.hostname;
  const pathSlug = slugify(parsed.pathname === "/" ? "index" : parsed.pathname);
  // Short 4-char hash to prevent collisions without being noisy
  const unique = hashText(artifactUrl).slice(0, 8);

  return {
    hostname,
    slug: `${pathSlug}-${unique}`,
  };
}

function formatFrontmatterScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(String(value));
}

function formatFrontmatter(data: Record<string, unknown>) {
  const lines = ["---"];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    lines.push(`${key}: ${formatFrontmatterScalar(value)}`);
  }

  lines.push("---", "");
  return lines.join("\n");
}

function buildFetchMarkdown(
  snapshot: PageSnapshot,
  scrape: Pick<ScrapeResult, "author" | "markdown" | "markdownEngine" | "published" | "site" | "title" | "wordCount">
) {
  const metadata = {
    title: scrape.title ?? snapshot.title,
    description: snapshot.description,
    site: scrape.site,
    author: scrape.author,
    published: scrape.published,
    url: snapshot.canonicalUrl || snapshot.finalUrl || snapshot.requestedUrl,
    fetchedAt: snapshot.fetchedAt
  };

  return `${formatFrontmatter(metadata)}${scrape.markdown.trim()}\n`;
}

export async function saveSearchArtifacts(
  outputDir: string,
  query: string,
  provider: SearchResult["provider"],
  results: SearchResult[],
  browser: BrowserRunInfo
): Promise<SavedFile[]> {
  const querySlug = slugify(query);
  const base = path.resolve(outputDir, "searches", querySlug);
  const filePath = path.join(base, `${provider}.json`);
  await writeJson(filePath, {
    query,
    provider,
    count: results.length,
    savedAt: new Date().toISOString(),
    results,
  });

  return [{ label: "search-results", path: filePath }];
}

export async function saveCollectArtifacts(
  outputDir: string,
  payload: {
    browser: BrowserRunInfo;
    fetchedAt: string;
    provider: SearchResult["provider"];
    query: string;
    results: Array<{
      error: string | null;
      finalUrl: string | null;
      link: string;
      savedFiles: SavedFile[];
      status: number | null;
      title: string;
    }>;
  }
): Promise<SavedFile[]> {
  const querySlug = slugify(payload.query);
  const base = path.resolve(outputDir, "searches", querySlug);
  const filePath = path.join(base, "collect.json");
  await writeJson(filePath, payload);

  return [{ label: "collect-report", path: filePath }];
}

export async function saveFetchArtifacts(
  outputDir: string,
  snapshot: PageSnapshot,
  scrape: Pick<ScrapeResult, "author" | "markdown" | "markdownEngine" | "published" | "site" | "title" | "wordCount">,
  options: FetchArtifactOptions = {}
): Promise<SavedFile[]> {
  const frontmatter = options.frontmatter ?? true;
  const artifact = getUrlArtifactPath(outputDir, snapshot.finalUrl, snapshot.requestedUrl);
  const siteDir = path.join(outputDir, "sites", artifact.hostname);
  const markdownPath = path.join(siteDir, `${artifact.slug}.md`);
  const savedFiles: SavedFile[] = [];

  if (frontmatter) {
    await writeText(markdownPath, buildFetchMarkdown(snapshot, scrape));
  } else {
    await writeText(markdownPath, scrape.markdown);
  }
  savedFiles.push({ label: "markdown", path: markdownPath });

  if (options.saveJson) {
    const { html, ...metadata } = snapshot;
    const { markdown, ...scrapeMetadata } = scrape;
    const metadataPath = path.join(siteDir, `${artifact.slug}.json`);
    await writeJson(metadataPath, {
      ...metadata,
      htmlBytes: html.length,
      markdownBytes: markdown.length,
      scrape: scrapeMetadata
    });
    savedFiles.push({ label: "metadata", path: metadataPath });
  }

  if (options.saveHtml) {
    const htmlPath = path.join(siteDir, `${artifact.slug}.html`);
    await writeText(htmlPath, snapshot.html);
    savedFiles.push({ label: "html", path: htmlPath });
  }

  return savedFiles;
}

export async function saveCrawlArtifacts(outputDir: string, result: CrawlResult): Promise<SavedFile[]> {
  const artifact = getUrlArtifactPath(outputDir, result.rootUrl);
  const filePath = path.join(outputDir, "crawls", artifact.hostname, `${artifact.slug}.json`);
  await writeJson(filePath, result);

  return [{ label: "crawl-report", path: filePath }];
}
