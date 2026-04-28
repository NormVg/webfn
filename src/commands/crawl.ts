import { Option } from "commander";
import type { Command } from "commander";

import type { NavigationWaitUntil } from "../core/browser.js";
import { formatBrowserRunInfo } from "../core/browser.js";
import { crawlSite } from "../core/crawler.js";
import { buildScrapeResult } from "../core/parser.js";
import { saveCrawlArtifacts, saveFetchArtifacts } from "../core/storage.js";
import { printMetric, printSavedFiles, printSection, startProgress, startSpinner } from "../lib/ui.js";
import {
  addBrowserOptions,
  addMarkdownEngineOption,
  addStorageOptions,
  addWaitUntilOption,
  parsePositiveInteger,
  resolveStorageOptions,
  toBrowserLaunchOptions
} from "./common.js";

type ProgressReporter = {
  fail: (message: string) => void;
  set: (current: number, message?: string) => void;
  stop: () => void;
  succeed: (message: string) => void;
  update: (message: string) => void;
};

type CrawlCommandOptions = {
  chrome?: string;
  config?: string;
  delayMs: number;
  depth: number;
  engine?: "chrome" | "lightpanda";
  fetchPages?: boolean;
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  markdownEngine: "defuddle" | "turndown";
  maxPages: number;
  mode: "auto" | "sitemap" | "links";
  outputDir?: string;
  saveHtml?: boolean;
  saveJson?: boolean;
  store: boolean;
  timeoutMs: number;
  userAgent?: string;
  waitUntil: NavigationWaitUntil;
};

export function registerCrawlCommand(program: Command) {
  const command = program
    .command("crawl")
    .description("Discover pages from a sitemap or by following internal links")
    .argument("<url>", "Root site URL")
    .addOption(
      new Option("--mode <mode>", "Crawl strategy")
        .choices(["auto", "sitemap", "links"])
        .default("auto")
    )
    .option("--depth <count>", "Max depth for internal-link crawling", parsePositiveInteger, 2)
    .option("--max-pages <count>", "Max number of pages to process", parsePositiveInteger, 25)
    .option("--fetch-pages", "Save fetched page artifacts for every crawled page")
    .option("--save-html", "Also save rendered HTML for fetched crawl pages")
    .option("--save-json", "Also save metadata JSON for fetched crawl pages")
    .option("--json", "Print the crawl payload as JSON");

  addBrowserOptions(command);
  addMarkdownEngineOption(command);
  addStorageOptions(command);
  addWaitUntilOption(command);

  command.action(async (url: string, options: CrawlCommandOptions) => {
    const spinner = startSpinner("Preparing crawl");

    try {
      const browserOptions = toBrowserLaunchOptions(options);
      const storage = await resolveStorageOptions(options);
      const crawlPageFiles: Awaited<ReturnType<typeof saveFetchArtifacts>> = [];
      const liveState: { progress: ProgressReporter | null; usedProgress: boolean } = {
        progress: null,
        usedProgress: false
      };

      const result = await crawlSite(url, {
        browser: browserOptions,
        maxDepth: options.depth,
        maxPages: options.maxPages,
        mode: options.mode,
        onPageError: ({ error, processed, queued, url: currentUrl }) => {
          if (!liveState.progress) {
            spinner.stop();
            liveState.progress = startProgress("Crawl", options.maxPages, `${currentUrl} (queue ${queued})`);
            liveState.usedProgress = true;
          }

          liveState.progress.set(processed, `${currentUrl} error: ${error}`);
        },
        onPageFetched: async ({ processed, queued, snapshot }) => {
          if (!liveState.progress) {
            spinner.stop();
            liveState.progress = startProgress("Crawl", options.maxPages, `${snapshot.finalUrl} (queue ${queued})`);
            liveState.usedProgress = true;
          }

          liveState.progress.set(processed, `${snapshot.finalUrl} (queue ${queued})`);

          if (!options.fetchPages || !options.store) {
            return;
          }

          const scrape = await buildScrapeResult(snapshot, {
            markdownEngine: options.markdownEngine
          });
          crawlPageFiles.push(
            ...(await saveFetchArtifacts(storage.path, snapshot, scrape, {
              saveHtml: Boolean(options.saveHtml),
              saveJson: Boolean(options.saveJson)
            }))
          );
        },
        onStatus: (message) => {
          if (liveState.progress) {
            liveState.progress.update(message);
            return;
          }

          spinner.update(message);
        },
        timeoutMs: browserOptions.timeoutMs,
        waitUntil: options.waitUntil
      });

      const activeProgress = liveState.progress;

      if (liveState.usedProgress && activeProgress) {
        activeProgress.succeed(`Crawl complete: ${result.pages.length} page(s)`);
      } else {
        spinner.succeed(`Crawl complete: ${result.pages.length} page(s)`);
      }

      const savedFiles = options.store
        ? [...crawlPageFiles, ...(await saveCrawlArtifacts(storage.path, result))]
        : [];

      if (options.json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              crawl: result,
              fetchPages: Boolean(options.fetchPages),
              savedFiles,
              storage
            },
            null,
            2
          )}\n`
        );
        return;
      }

      printSection(`Crawl: ${result.rootUrl}`);
      printMetric("Browser", formatBrowserRunInfo(result.browser));
      printMetric("Fetch pages", options.fetchPages ? "enabled" : "disabled");
      printMetric("Strategy", result.strategy);
      printMetric("Pages", result.pages.length);
      printMetric("Sitemaps", result.sitemapUrls.length);
      printMetric("Storage", storage.path);
      result.pages.slice(0, 10).forEach((page, index) => {
        const status = page.status ?? "error";
        console.log(`\n${index + 1}. [${status}] ${page.finalUrl}`);
      });

      printSavedFiles(savedFiles);
    } catch (error: unknown) {
      spinner.fail(`Crawl failed: ${url}`);
      throw error;
    }
  });
}
