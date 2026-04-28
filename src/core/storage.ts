import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { hashText, slugify } from "../lib/text.js";
import type { CrawlResult, PageSnapshot, ScrapeResult, SearchResult } from "./types.js";

export type SavedFile = {
  label: string;
  path: string;
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

function getUrlArtifactBase(outputDir: string, url: string) {
  const parsed = new URL(url);
  const directory = path.resolve(outputDir, parsed.hostname);
  const pathSlug = slugify(parsed.pathname === "/" ? "home" : parsed.pathname);
  const unique = hashText(url);

  return {
    directory,
    name: `${pathSlug}-${unique}`
  };
}

export async function saveSearchArtifacts(
  outputDir: string,
  query: string,
  provider: SearchResult["provider"],
  results: SearchResult[]
): Promise<SavedFile[]> {
  const base = path.resolve(outputDir, "search", `${slugify(query)}-${hashText(query)}`);
  const filePath = path.join(base, `${provider}.json`);
  await writeJson(filePath, {
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
  scrape: Pick<ScrapeResult, "author" | "markdown" | "published" | "site" | "title" | "wordCount">
): Promise<SavedFile[]> {
  const base = getUrlArtifactBase(outputDir, snapshot.finalUrl);
  const metadataPath = path.join(base.directory, `fetch-${base.name}.json`);
  const htmlPath = path.join(base.directory, `fetch-${base.name}.html`);
  const markdownPath = path.join(base.directory, `fetch-${base.name}.md`);
  const { html, ...metadata } = snapshot;
  const { markdown, ...scrapeMetadata } = scrape;
  await writeJson(metadataPath, {
    ...metadata,
    htmlBytes: html.length,
    markdownBytes: markdown.length,
    scrape: scrapeMetadata
  });
  await writeText(htmlPath, html);
  await writeText(markdownPath, markdown);

  return [
    { label: "fetch-metadata", path: metadataPath },
    { label: "fetch-html", path: htmlPath },
    { label: "fetch-markdown", path: markdownPath }
  ];
}

export async function saveScrapeArtifacts(outputDir: string, scrape: ScrapeResult): Promise<SavedFile[]> {
  const base = getUrlArtifactBase(outputDir, scrape.finalUrl);
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
