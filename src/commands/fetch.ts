import type { Command } from "commander";
import chalk from "chalk";

import type { NavigationWaitUntil } from "../core/browser.js";
import { formatBrowserRunInfo } from "../core/browser.js";
import { fetchPageSnapshotWithEngine, summarizePageSnapshot } from "../core/fetcher.js";
import { buildScrapeResult } from "../core/parser.js";
import { saveFetchArtifacts } from "../core/storage.js";
import { logger } from "../lib/logger.js";
import { printMetric, printSavedFiles, printSection } from "../lib/ui.js";
import { resolvePreferredUrl } from "../lib/url.js";
import {
  addBrowserOptions,
  addMarkdownEngineOption,
  addStorageOptions,
  addWaitUntilOption,
  resolveStorageOptions,
  toBrowserLaunchOptions
} from "./common.js";

type FetchCommandOptions = {
  chrome?: string;
  config?: string;
  delayMs: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  markdownEngine: "defuddle" | "turndown";
  outputDir?: string;
  saveHtml?: boolean;
  saveJson?: boolean;
  store: boolean;
  timeoutMs: number;
  userAgent?: string;
  waitUntil: NavigationWaitUntil;
};

export function registerFetchCommand(program: Command) {
  const command = program
    .command("fetch")
    .description("Load a page and save readable markdown with embedded metadata")
    .argument("<url>", "Page URL")
    .option("--json", "Print a JSON summary")
    .option("--save-html", "Also save rendered HTML next to the markdown file")
    .option("--save-json", "Also save metadata JSON next to the markdown file");

  addBrowserOptions(command);
  addMarkdownEngineOption(command);
  addStorageOptions(command);
  addWaitUntilOption(command);

  command.action(async (url: string, options: FetchCommandOptions) => {
    const browserOptions = toBrowserLaunchOptions(options);
    const storage = await resolveStorageOptions(options);
    const snapshot = await fetchPageSnapshotWithEngine(browserOptions, url, {
      waitUntil: options.waitUntil
    });
    const summary = summarizePageSnapshot(snapshot);
    const scrape = await buildScrapeResult(snapshot, {
      markdownEngine: options.markdownEngine
    });
    const displayUrl = resolvePreferredUrl(snapshot.finalUrl, snapshot.requestedUrl);
    const savedFiles = options.store
      ? await saveFetchArtifacts(storage.path, snapshot, scrape, {
          saveHtml: Boolean(options.saveHtml),
          saveJson: Boolean(options.saveJson)
        })
      : [];

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            savedFiles,
            snapshot: {
              ...summary,
              markdownEngine: scrape.markdownEngine,
              markdownLength: scrape.markdown.length,
              wordCount: scrape.wordCount
            },
            storage
          },
          null,
          2
        )}\n`
      );
      return;
    }

    logger.success(`Fetched ${displayUrl}`);
    printSection(summary.title ?? "Fetched Page");
    printMetric("URL", displayUrl);
    printMetric("Browser", formatBrowserRunInfo(snapshot.browser));
    printMetric("Markdown", scrape.markdownEngine);
    printMetric("Status", summary.status ?? "unknown");
    printMetric("Headings", summary.headings);
    printMetric("Links", summary.links);
    printMetric("Media", summary.media);
    printMetric("HTML bytes", summary.htmlLength);
    printMetric("MD bytes", scrape.markdown.length);
    printMetric("Storage", storage.path);
    if (summary.description) {
      console.log(`\n${chalk.dim(summary.description)}`);
    }
    printSavedFiles(savedFiles);
  });
}
