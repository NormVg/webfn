import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { hashText, slugify } from "../lib/text.js";
import type { BrowserRunInfo } from "./browser.js";
import type { CrawlResult, PageSnapshot, ScrapeResult, SearchResult } from "./types.js";

export type SavedFile = {
  label: string;
  path: string;
};

type FetchArtifactOptions = {
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

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function getUrlArtifactBase(outputDir: string, url: string, fallbackUrl?: string) {
  const artifactUrl = isHttpUrl(url) ? url : fallbackUrl && isHttpUrl(fallbackUrl) ? fallbackUrl : url;
  const parsed = new URL(artifactUrl);
  const directory = path.resolve(outputDir, parsed.hostname);
  const pathSlug = slugify(parsed.pathname === "/" ? "home" : parsed.pathname);
  const unique = hashText(artifactUrl);

  return {
    directory,
    name: `${pathSlug}-${unique}`
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
    if (value && typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`  ${nestedKey}: ${formatFrontmatterScalar(nestedValue)}`);
      }
      continue;
    }

    lines.push(`${key}: ${formatFrontmatterScalar(value)}`);
  }

  lines.push("---", "");
  return lines.join("\n");
}

function buildFetchMarkdown(
  snapshot: PageSnapshot,
  scrape: Pick<ScrapeResult, "author" | "markdown" | "published" | "site" | "title" | "wordCount">
) {
  const metadata = {
    title: scrape.title ?? snapshot.title,
    description: snapshot.description,
    site: scrape.site,
    author: scrape.author,
    published: scrape.published,
    requestedUrl: snapshot.requestedUrl,
    finalUrl: snapshot.finalUrl,
    canonicalUrl: snapshot.canonicalUrl,
    status: snapshot.status,
    fetchedAt: snapshot.fetchedAt,
    browser: snapshot.browser,
    htmlBytes: snapshot.html.length,
    markdownBytes: scrape.markdown.length,
    wordCount: scrape.wordCount,
    headings: snapshot.headings.length,
    links: snapshot.links.length,
    media: snapshot.media.length
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
  const base = path.resolve(outputDir, "search", `${slugify(query)}-${hashText(query)}`);
  const filePath = path.join(base, `${provider}.json`);
  await writeJson(filePath, {
    browser,
    count: results.length,
    provider,
    query,
    results,
    savedAt: new Date().toISOString()
  });

  return [{ label: "search-results", path: filePath }];
}

export async function saveFetchArtifacts(
  outputDir: string,
  snapshot: PageSnapshot,
  scrape: Pick<ScrapeResult, "author" | "markdown" | "published" | "site" | "title" | "wordCount">,
  options: FetchArtifactOptions = {}
): Promise<SavedFile[]> {
  const base = getUrlArtifactBase(outputDir, snapshot.finalUrl, snapshot.requestedUrl);
  const artifactDirectory = path.join(base.directory, `fetch-${base.name}`);
  const metadataPath = path.join(artifactDirectory, "metadata.json");
  const htmlPath = path.join(artifactDirectory, "page.html");
  const markdownPath = path.join(artifactDirectory, "index.md");
  const { html, ...metadata } = snapshot;
  const { markdown, ...scrapeMetadata } = scrape;
  const savedFiles: SavedFile[] = [];

  await writeText(markdownPath, buildFetchMarkdown(snapshot, scrape));
  savedFiles.push({ label: "fetch-markdown", path: markdownPath });

  if (options.saveJson) {
    await writeJson(metadataPath, {
      ...metadata,
      htmlBytes: html.length,
      markdownBytes: markdown.length,
      scrape: scrapeMetadata
    });
    savedFiles.push({ label: "fetch-metadata", path: metadataPath });
  }

  if (options.saveHtml) {
    await writeText(htmlPath, html);
    savedFiles.push({ label: "fetch-html", path: htmlPath });
  }

  return savedFiles;
}

export async function saveScrapeArtifacts(outputDir: string, scrape: ScrapeResult): Promise<SavedFile[]> {
  const base = getUrlArtifactBase(outputDir, scrape.finalUrl, scrape.requestedUrl);
  const metadataPath = path.join(base.directory, `scrape-${base.name}.json`);
  const markdownPath = path.join(base.directory, `scrape-${base.name}.md`);
  const { markdown, ...metadata } = scrape;

  await writeJson(metadataPath, {
    ...metadata,
    markdownBytes: markdown.length
  });
  await writeText(markdownPath, markdown);

  return [
    { label: "scrape-metadata", path: metadataPath },
    { label: "scrape-markdown", path: markdownPath }
  ];
}

export async function saveCrawlArtifacts(outputDir: string, result: CrawlResult): Promise<SavedFile[]> {
  const base = getUrlArtifactBase(outputDir, result.rootUrl);
  const filePath = path.join(base.directory, `crawl-${base.name}.json`);
  await writeJson(filePath, result);

  return [{ label: "crawl-report", path: filePath }];
}
