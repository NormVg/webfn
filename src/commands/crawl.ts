import { Option } from "commander";
import type { Command } from "commander";

import type { NavigationWaitUntil } from "../core/browser.js";
import { formatBrowserRunInfo } from "../core/browser.js";
import { crawlSite } from "../core/crawler.js";
import { buildScrapeResult } from "../core/parser.js";
import { saveCrawlArtifacts, saveFetchArtifacts } from "../core/storage.js";
import {
  printKeyValueBox,
  printResultList,
  printSavedFiles,
  startProgress,
  startSpinner,
  writeJsonOutput,
} from "../lib/ui.js";
import type { ProgressHandle } from "../lib/ui.js";
import {
  addBrowserOptions,
  addMarkdownEngineOption,
  addOutputOptions,
  addWaitUntilOption,
  mergeConfigDefaults,
  parsePositiveInteger,
  resolveStorageOptions,
  shouldOutputJson,
  toBrowserLaunchOptions,
} from "./common.js";

type CrawlCommandOptions = {
  chrome?: string;
  config?: string;
  delay: number;
  depth: number;
  engine?: "chrome" | "lightpanda";
  fetchPages?: boolean;
  headed?: boolean;
  html?: boolean;
  json?: boolean;
  lpPort: number;
  maxPages: number;
  mdEngine: "defuddle" | "turndown";
  meta?: boolean;
  mode: "auto" | "sitemap" | "links";
  outputDir?: string;
  save: boolean;
  timeout: number;
  userAgent?: string;
  waitUntil: NavigationWaitUntil;
};

export function registerCrawlCommand(program: Command) {
  const command = program
    .command("crawl")
    .description("Discover pages via sitemap or internal links")
    .argument("<url>", "Root site URL")
    .addOption(
      new Option("--mode <mode>", "Crawl strategy")
        .choices(["auto", "sitemap", "links"])
        .default("auto")
    )
    .option("--depth <count>", "Max link-crawl depth", parsePositiveInteger, 2)
    .option("--max-pages <count>", "Max pages to process", parsePositiveInteger, 25)
    .option("--fetch-pages", "Save page artifacts for every crawled page")
    .option("--html", "Also save rendered HTML for crawled pages")
    .option("--meta", "Also save metadata JSON for crawled pages");

  addBrowserOptions(command);
  addMarkdownEngineOption(command);
  addOutputOptions(command);
  addWaitUntilOption(command);

  command.action(async (url: string, rawOptions: CrawlCommandOptions, cmd) => {
    const options = await mergeConfigDefaults(rawOptions, cmd);
    const spinner = startSpinner("Preparing crawl");

    try {
      const browserOptions = toBrowserLaunchOptions(options);
      const storage = await resolveStorageOptions(options);
      const crawlPageFiles: Awaited<ReturnType<typeof saveFetchArtifacts>> = [];
      const liveState: { progress: ProgressHandle | null; usedProgress: boolean } = {
        progress: null,
        usedProgress: false,
      };

      const result = await crawlSite(url, {
        browser: browserOptions,
        maxDepth: options.depth,
        maxPages: options.maxPages,
        mode: options.mode,
        onPageError: ({ error, processed, queued, url: currentUrl }) => {
          if (!liveState.progress) {
            spinner.stop();
            liveState.progress = startProgress("Crawling", options.maxPages, `${currentUrl} (queue ${queued})`);
            liveState.usedProgress = true;
          }
          liveState.progress.set(processed, `${currentUrl} error: ${error}`);
        },
        onPageFetched: async ({ processed, queued, snapshot }) => {
          if (!liveState.progress) {
            spinner.stop();
            liveState.progress = startProgress("Crawling", options.maxPages, `${snapshot.finalUrl} (queue ${queued})`);
            liveState.usedProgress = true;
          }
          liveState.progress.set(processed, `${snapshot.finalUrl} (queue ${queued})`);

          if (!options.fetchPages || !options.save) {
            return;
          }

          const scrape = await buildScrapeResult(snapshot, {
            markdownEngine: options.mdEngine,
          });
          crawlPageFiles.push(
            ...(await saveFetchArtifacts(storage.path, snapshot, scrape, {
              saveHtml: Boolean(options.html),
              saveJson: Boolean(options.meta),
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
        waitUntil: options.waitUntil,
      });

      const activeProgress = liveState.progress;
      if (liveState.usedProgress && activeProgress) {
        activeProgress.succeed(`Crawled ${result.pages.length} page(s)`);
      } else {
        spinner.succeed(`Crawled ${result.pages.length} page(s)`);
      }

      const savedFiles = options.save
        ? [...crawlPageFiles, ...(await saveCrawlArtifacts(storage.path, result))]
        : [];

      if (shouldOutputJson(options)) {
        writeJsonOutput({
          ok: true,
          command: "crawl",
          crawl: result,
          fetchPages: Boolean(options.fetchPages),
          files: savedFiles,
          storage,
        });
        return;
      }

      printKeyValueBox(`Crawl: ${result.rootUrl}`, [
        { key: "Engine", value: formatBrowserRunInfo(result.browser) },
        { key: "Strategy", value: result.strategy },
        { key: "Fetch pages", value: options.fetchPages ? "enabled" : "disabled" },
        { key: "Pages", value: result.pages.length },
        { key: "Sitemaps", value: result.sitemapUrls.length },
        { key: "Storage", value: storage.path },
      ]);

      printResultList(
        "Pages",
        result.pages.map((p) => ({
          title: p.title ?? p.finalUrl,
          url: p.finalUrl,
          status: p.status,
          error: p.error,
        })),
        15
      );

      printSavedFiles(savedFiles);
    } catch (error: unknown) {
      spinner.fail(`Crawl failed: ${url}`);
      throw error;
    }
  });
}
