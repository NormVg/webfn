import { Option } from "commander";
import type { Command } from "commander";

import { formatBrowserRunInfo } from "../core/browser.js";
import type { SearchProvider } from "../core/search.js";
import { searchWeb } from "../core/search.js";
import { saveSearchArtifacts } from "../core/storage.js";
import {
  printKeyValueBox,
  printResultList,
  printSavedFiles,
  startSpinner,
  writeJsonOutput,
} from "../lib/ui.js";
import type { ResultItem } from "../lib/ui.js";
import {
  addBrowserOptions,
  addOutputOptions,
  parsePositiveInteger,
  resolveStorageOptions,
  shouldOutputJson,
  toBrowserLaunchOptions,
} from "./common.js";

type SearchCommandOptions = {
  chrome?: string;
  config?: string;
  delay: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lpPort: number;
  outputDir?: string;
  provider: SearchProvider;
  results: number;
  save: boolean;
  timeout: number;
  userAgent?: string;
};

export function registerSearchCommand(program: Command) {
  const command = program
    .command("search")
    .description("Search the web with a browser-backed provider")
    .argument("<query>", "Search query")
    .option("-n, --results <count>", "Max results to return", parsePositiveInteger, 10)
    .addOption(
      new Option("--provider <provider>", "Search provider")
        .choices(["google", "duckduckgo"] satisfies SearchProvider[])
        .default("google")
    );

  addBrowserOptions(command);
  addOutputOptions(command);

  command.action(async (query: string, options: SearchCommandOptions) => {
    const spinner = startSpinner(`Searching ${options.provider} for "${query}"`);

    try {
      const browserOptions = toBrowserLaunchOptions(options);
      const storage = await resolveStorageOptions(options);
      const response = await searchWeb(browserOptions, query, {
        delayMs: browserOptions.delayMs,
        maxResults: options.results,
        provider: options.provider,
        timeoutMs: browserOptions.timeoutMs,
      });
      const { browser, results } = response;

      const savedFiles = options.save
        ? await saveSearchArtifacts(storage.path, query, options.provider, results, browser)
        : [];

      spinner.succeed(`Found ${results.length} result(s)`);

      if (shouldOutputJson(options)) {
        writeJsonOutput({
          ok: true,
          command: "search",
          query,
          provider: options.provider,
          browser,
          results,
          files: savedFiles,
          storage,
        });
        return;
      }

      printKeyValueBox(`Search: ${query}`, [
        { key: "Provider", value: results[0]?.provider ?? options.provider },
        { key: "Engine", value: formatBrowserRunInfo(browser) },
        { key: "Results", value: results.length },
        { key: "Storage", value: storage.path },
      ]);

      printResultList(
        "Results",
        results.map((r) => {
          const item: ResultItem = { title: r.title, url: r.link };
          if (r.snippet) item.detail = r.snippet;
          return item;
        })
      );

      printSavedFiles(savedFiles);
    } catch (error: unknown) {
      spinner.fail(`Search failed: ${query}`);
      throw error;
    }
  });
}
