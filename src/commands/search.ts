import { Option } from "commander";
import type { Command } from "commander";

import type { SearchProvider } from "../core/search.js";
import { searchWeb } from "../core/search.js";
import { saveSearchArtifacts } from "../core/storage.js";
import { logger } from "../lib/logger.js";
import { addBrowserOptions, addStorageOptions, parsePositiveInteger, toBrowserLaunchOptions } from "./common.js";

type SearchCommandOptions = {
  chrome?: string;
  delayMs: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  outputDir: string;
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
    const results = await searchWeb(browserOptions, query, {
      delayMs: browserOptions.delayMs,
      maxResults: options.results,
      provider: options.provider,
      timeoutMs: browserOptions.timeoutMs
    });

    const savedFiles = options.store
      ? await saveSearchArtifacts(options.outputDir, query, options.provider, results)
      : [];

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            count: results.length,
            provider: options.provider,
            query,
            results,
            savedFiles
          },
          null,
          2
        )}\n`
      );
      return;
    }

    logger.success(`Found ${results.length} result(s) for "${query}" using ${options.provider}.`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   ${result.link}`);
      if (result.snippet) {
        console.log(`   ${result.snippet}`);
      }
    });

    if (savedFiles.length > 0) {
      logger.info(`Saved ${savedFiles.length} artifact(s):`);
      savedFiles.forEach((file) => console.log(`- ${file.path}`));
    }
  });
}
