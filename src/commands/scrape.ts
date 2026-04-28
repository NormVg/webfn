import type { Command } from "commander";
import chalk from "chalk";

import type { NavigationWaitUntil } from "../core/browser.js";
import { formatBrowserRunInfo } from "../core/browser.js";
import { fetchPageSnapshotWithEngine } from "../core/fetcher.js";
import { buildScrapeResult } from "../core/parser.js";
import { saveScrapeArtifacts } from "../core/storage.js";
import { printMetric, printSavedFiles, printSection, startSpinner } from "../lib/ui.js";
import { resolvePreferredUrl } from "../lib/url.js";
import {
  addBrowserOptions,
  addMarkdownEngineOption,
  addStorageOptions,
  addWaitUntilOption,
  resolveStorageOptions,
  toBrowserLaunchOptions
} from "./common.js";

type ScrapeCommandOptions = {
  chrome?: string;
  config?: string;
  delayMs: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  markdownEngine: "defuddle" | "turndown";
  outputDir?: string;
  saveJson?: boolean;
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
    .option("--save-json", "Also save scrape metadata JSON next to the markdown file")
    .option("--stdout", "Print the extracted markdown to stdout");

  addBrowserOptions(command);
  addMarkdownEngineOption(command);
  addStorageOptions(command);
  addWaitUntilOption(command);

  command.action(async (url: string, options: ScrapeCommandOptions) => {
    const spinner = startSpinner(`Scraping ${url}`);

    try {
    const browserOptions = toBrowserLaunchOptions(options);
    const storage = await resolveStorageOptions(options);
    const snapshot = await fetchPageSnapshotWithEngine(browserOptions, url, {
      waitUntil: options.waitUntil
    });
    const scrape = await buildScrapeResult(snapshot, {
      markdownEngine: options.markdownEngine
    });
    const displayUrl = resolvePreferredUrl(scrape.finalUrl, scrape.requestedUrl);
    const savedFiles = options.store
      ? await saveScrapeArtifacts(storage.path, scrape, {
          saveJson: Boolean(options.saveJson)
        })
      : [];
    spinner.succeed(`Scrape complete: ${displayUrl}`);

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            savedFiles,
            scrape: {
              ...scrape,
              markdownLength: scrape.markdown.length
            },
            storage
          },
          null,
          2
        )}\n`
      );
      return;
    }

    printSection(scrape.title ?? "Scraped Page");
    printMetric("URL", displayUrl);
    printMetric("Browser", formatBrowserRunInfo(scrape.browser));
    printMetric("Markdown", scrape.markdownEngine);
    printMetric("Words", scrape.wordCount ?? "unknown");
    printMetric("Headings", scrape.headings.length);
    printMetric("Links", scrape.links.length);
    printMetric("Media", scrape.media.length);
    printMetric("Storage", storage.path);
    if (scrape.description) {
      console.log(`\n${chalk.dim(scrape.description)}`);
    }

    if (options.stdout) {
      printSection("Markdown");
      process.stdout.write(`${scrape.markdown.trim()}\n`);
    }

    printSavedFiles(savedFiles);
    } catch (error: unknown) {
      spinner.fail(`Scrape failed: ${url}`);
      throw error;
    }
  });
}
