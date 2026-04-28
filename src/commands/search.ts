import { Option } from "commander";
import type { Command } from "commander";

import { formatBrowserRunInfo } from "../core/browser.js";
import type { SearchProvider } from "../core/search.js";
import { searchWeb } from "../core/search.js";
import { saveSearchArtifacts } from "../core/storage.js";
import { logger } from "../lib/logger.js";
import { printMetric, printSavedFiles, printSection } from "../lib/ui.js";
import {
  addBrowserOptions,
  addStorageOptions,
  parsePositiveInteger,
  resolveStorageOptions,
  toBrowserLaunchOptions
} from "./common.js";

type SearchCommandOptions = {
  chrome?: string;
  config?: string;
  delayMs: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  outputDir?: string;
  provider: SearchProvider;
  results: number;
  store: boolean;
  timeoutMs: number;
  userAgent?: string;
};

export function registerSearchCommand(program: Command) {
  const command = program
    .command("search")
    .description("Search the web with a browser-backed provider")
    .argument("<query>", "Search query")
    .option("-n, --results <count>", "Number of results to return", parsePositiveInteger, 10)
    .addOption(
      new Option("--provider <provider>", "Search provider")
        .choices(["google", "duckduckgo"] satisfies SearchProvider[])
        .default("google")
    )
    .option("--json", "Print the result payload as JSON");

  addBrowserOptions(command);
  addStorageOptions(command);

  command.action(async (query: string, options: SearchCommandOptions) => {
    const browserOptions = toBrowserLaunchOptions(options);
    const storage = await resolveStorageOptions(options);
    const response = await searchWeb(browserOptions, query, {
      delayMs: browserOptions.delayMs,
      maxResults: options.results,
      provider: options.provider,
      timeoutMs: browserOptions.timeoutMs
    });
    const { browser, results } = response;

    const savedFiles = options.store
      ? await saveSearchArtifacts(storage.path, query, options.provider, results, browser)
      : [];

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            browser,
            count: results.length,
            provider: options.provider,
            query,
            results,
            savedFiles,
            storage
          },
          null,
          2
        )}\n`
      );
      return;
    }

    logger.success(
      `Found ${results.length} result(s) for "${query}" using ${options.provider} via ${formatBrowserRunInfo(browser)}.`
    );
    printSection(`Search: ${query}`);
    printMetric("Provider", options.provider);
    printMetric("Browser", formatBrowserRunInfo(browser));
    printMetric("Results", results.length);
    printMetric("Storage", storage.path);
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   ${result.link}`);
      if (result.snippet) {
        console.log(`   ${result.snippet}`);
      }
    });

    printSavedFiles(savedFiles);
  });
}
