import type { Command } from "commander";

import type { NavigationWaitUntil } from "../core/browser.js";
import { fetchPageSnapshotWithEngine } from "../core/fetcher.js";
import { buildScrapeResult } from "../core/parser.js";
import { saveScrapeArtifacts } from "../core/storage.js";
import { logger } from "../lib/logger.js";
import { addBrowserOptions, addStorageOptions, addWaitUntilOption, toBrowserLaunchOptions } from "./common.js";

type ScrapeCommandOptions = {
  chrome?: string;
  delayMs: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  outputDir: string;
  stdout?: boolean;
  store: boolean;
  timeoutMs: number;
  userAgent?: string;
  waitUntil: NavigationWaitUntil;
};

export function registerScrapeCommand(program: Command) {
  const command = program
    .command("scrape")
    .description("Extract readable markdown plus structured page metadata")
    .argument("<url>", "Page URL")
    .option("--json", "Print the structured scrape payload as JSON")
    .option("--stdout", "Print the extracted markdown to stdout");

  addBrowserOptions(command);
  addStorageOptions(command);
  addWaitUntilOption(command);

  command.action(async (url: string, options: ScrapeCommandOptions) => {
    const browserOptions = toBrowserLaunchOptions(options);
    const snapshot = await fetchPageSnapshotWithEngine(browserOptions, url, {
      waitUntil: options.waitUntil
    });
    const scrape = await buildScrapeResult(snapshot);
    const savedFiles = options.store ? await saveScrapeArtifacts(options.outputDir, scrape) : [];

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            savedFiles,
            scrape: {
              ...scrape,
              markdownLength: scrape.markdown.length
            }
          },
          null,
          2
        )}\n`
      );
      return;
    }

    logger.success(`Scraped ${scrape.finalUrl}`);
    console.log(`Title: ${scrape.title ?? "(none)"}`);
    console.log(`Description: ${scrape.description ?? "(none)"}`);
    console.log(`Word count: ${scrape.wordCount ?? "unknown"}`);
    console.log(`Headings: ${scrape.headings.length}`);
    console.log(`Links: ${scrape.links.length}`);
    console.log(`Media: ${scrape.media.length}`);

    if (options.stdout) {
      console.log("");
      process.stdout.write(`${scrape.markdown.trim()}\n`);
    }

    if (savedFiles.length > 0) {
      logger.info(`Saved ${savedFiles.length} artifact(s):`);
      savedFiles.forEach((file) => console.log(`- ${file.path}`));
    }
  });
}
