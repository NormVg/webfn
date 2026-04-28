import type { Command } from "commander";

import type { NavigationWaitUntil } from "../core/browser.js";
import { fetchPageSnapshotWithEngine, summarizePageSnapshot } from "../core/fetcher.js";
import { buildScrapeResult } from "../core/parser.js";
import { saveFetchArtifacts } from "../core/storage.js";
import { logger } from "../lib/logger.js";
import { addBrowserOptions, addStorageOptions, addWaitUntilOption, toBrowserLaunchOptions } from "./common.js";

type FetchCommandOptions = {
  chrome?: string;
  delayMs: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  outputDir: string;
  store: boolean;
  timeoutMs: number;
  userAgent?: string;
  waitUntil: NavigationWaitUntil;
};

export function registerFetchCommand(program: Command) {
  const command = program
    .command("fetch")
    .description("Load a page and save rendered HTML, markdown, and metadata")
    .argument("<url>", "Page URL")
    .option("--json", "Print a JSON summary");

  addBrowserOptions(command);
  addStorageOptions(command);
  addWaitUntilOption(command);

  command.action(async (url: string, options: FetchCommandOptions) => {
    const browserOptions = toBrowserLaunchOptions(options);
    const snapshot = await fetchPageSnapshotWithEngine(browserOptions, url, {
      waitUntil: options.waitUntil
    });
    const summary = summarizePageSnapshot(snapshot);
    const scrape = await buildScrapeResult(snapshot);
    const savedFiles = options.store ? await saveFetchArtifacts(options.outputDir, snapshot, scrape) : [];

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            savedFiles,
            snapshot: {
              ...summary,
              markdownLength: scrape.markdown.length,
              wordCount: scrape.wordCount
            }
          },
          null,
          2
        )}\n`
      );
      return;
    }

    logger.success(`Fetched ${summary.finalUrl}`);
    console.log(`Title: ${summary.title ?? "(none)"}`);
    console.log(`Status: ${summary.status ?? "unknown"}`);
    console.log(`Description: ${summary.description ?? "(none)"}`);
    console.log(`Headings: ${summary.headings}`);
    console.log(`Links: ${summary.links}`);
    console.log(`Media: ${summary.media}`);
    console.log(`HTML bytes: ${summary.htmlLength}`);
    console.log(`Markdown bytes: ${scrape.markdown.length}`);

    if (savedFiles.length > 0) {
      logger.info(`Saved ${savedFiles.length} artifact(s):`);
      savedFiles.forEach((file) => console.log(`- ${file.path}`));
    }
  });
}
