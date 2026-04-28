import { Option } from "commander";
import type { Command } from "commander";

import { formatBrowserRunInfo } from "../core/browser.js";
import { crawlSite } from "../core/crawler.js";
import { saveCrawlArtifacts } from "../core/storage.js";
import { logger } from "../lib/logger.js";
import {
  addBrowserOptions,
  addStorageOptions,
  parsePositiveInteger,
  resolveStorageOptions,
  toBrowserLaunchOptions
} from "./common.js";

type CrawlCommandOptions = {
  chrome?: string;
  config?: string;
  delayMs: number;
  depth: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  maxPages: number;
  mode: "auto" | "sitemap" | "links";
  outputDir?: string;
  store: boolean;
  timeoutMs: number;
  userAgent?: string;
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
    .option("--json", "Print the crawl payload as JSON");

  addBrowserOptions(command);
  addStorageOptions(command);

  command.action(async (url: string, options: CrawlCommandOptions) => {
    const browserOptions = toBrowserLaunchOptions(options);
    const storage = await resolveStorageOptions(options);
    const result = await crawlSite(url, {
      browser: browserOptions,
      maxDepth: options.depth,
      maxPages: options.maxPages,
      mode: options.mode,
      timeoutMs: browserOptions.timeoutMs
    });

    const savedFiles = options.store ? await saveCrawlArtifacts(storage.path, result) : [];

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            crawl: result,
            savedFiles,
            storage
          },
          null,
          2
        )}\n`
      );
      return;
    }

    logger.success(`Crawled ${result.pages.length} page(s) using ${result.strategy}.`);
    console.log(`Browser: ${formatBrowserRunInfo(result.browser)}`);
    console.log(`Root: ${result.rootUrl}`);
    console.log(`Sitemap URLs discovered: ${result.sitemapUrls.length}`);
    result.pages.slice(0, 10).forEach((page, index) => {
      const status = page.status ?? "error";
      console.log(`${index + 1}. [${status}] ${page.finalUrl}`);
    });

    if (savedFiles.length > 0) {
      logger.info(`Saved ${savedFiles.length} artifact(s):`);
      savedFiles.forEach((file) => console.log(`- ${file.path}`));
    }
  });
}
