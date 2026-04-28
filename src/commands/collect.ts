import { Option } from "commander";
import type { Command } from "commander";

import type { NavigationWaitUntil } from "../core/browser.js";
import { formatBrowserRunInfo } from "../core/browser.js";
import { fetchPageSnapshotWithEngine } from "../core/fetcher.js";
import { buildScrapeResult } from "../core/parser.js";
import type { SearchProvider } from "../core/search.js";
import { searchWeb } from "../core/search.js";
import { saveCollectArtifacts, saveFetchArtifacts, saveSearchArtifacts } from "../core/storage.js";
import { resolvePreferredUrl } from "../lib/url.js";
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

type CollectCommandOptions = {
  chrome?: string;
  config?: string;
  delayMs: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  json?: boolean;
  lightpandaPort: number;
  markdownEngine: "defuddle" | "turndown";
  outputDir?: string;
  provider: SearchProvider;
  results: number;
  saveHtml?: boolean;
  saveJson?: boolean;
  store: boolean;
  timeoutMs: number;
  userAgent?: string;
  waitUntil: NavigationWaitUntil;
};

type CollectedPage = {
  error: string | null;
  finalUrl: string | null;
  link: string;
  savedFiles: Awaited<ReturnType<typeof saveFetchArtifacts>>;
  status: number | null;
  title: string;
};

export function registerCollectCommand(program: Command) {
  const command = program
    .command("collect")
    .description("Search the web, fetch each result page, and save the collected artifacts")
    .argument("<query>", "Search query")
    .option("-n, --results <count>", "Number of search results to collect", parsePositiveInteger, 5)
    .addOption(
      new Option("--provider <provider>", "Search provider")
        .choices(["google", "duckduckgo"] satisfies SearchProvider[])
        .default("google")
    )
    .option("--json", "Print the collected payload as JSON")
    .option("--save-html", "Also save rendered HTML for each fetched page")
    .option("--save-json", "Also save metadata JSON for each fetched page");

  addBrowserOptions(command);
  addMarkdownEngineOption(command);
  addStorageOptions(command);
  addWaitUntilOption(command);

  command.action(async (query: string, options: CollectCommandOptions) => {
    const searchSpinner = startSpinner(`Searching ${options.provider} for "${query}"`);

    try {
      const browserOptions = toBrowserLaunchOptions(options);
      const storage = await resolveStorageOptions(options);
      const searchResponse = await searchWeb(browserOptions, query, {
        delayMs: browserOptions.delayMs,
        maxResults: options.results,
        provider: options.provider,
        timeoutMs: browserOptions.timeoutMs
      });
      searchSpinner.succeed(`Search complete: ${searchResponse.results.length} result(s)`);
      const collectedPages: CollectedPage[] = [];
      const progress = startProgress("Fetch", searchResponse.results.length, "Preparing result fetches");

      for (const [index, result] of searchResponse.results.entries()) {
        try {
          const snapshot = await fetchPageSnapshotWithEngine(browserOptions, result.link, {
            waitUntil: options.waitUntil
          });
          const scrape = await buildScrapeResult(snapshot, {
            markdownEngine: options.markdownEngine
          });
          const savedFiles = options.store
            ? await saveFetchArtifacts(storage.path, snapshot, scrape, {
                saveHtml: Boolean(options.saveHtml),
                saveJson: Boolean(options.saveJson)
              })
            : [];
          progress.set(index + 1, resolvePreferredUrl(snapshot.finalUrl, snapshot.requestedUrl));

          collectedPages.push({
            error: null,
            finalUrl: resolvePreferredUrl(snapshot.finalUrl, snapshot.requestedUrl),
            link: result.link,
            savedFiles,
            status: snapshot.status,
            title: result.title
          });
        } catch (error: unknown) {
          collectedPages.push({
            error: error instanceof Error ? error.message : String(error),
            finalUrl: null,
            link: result.link,
            savedFiles: [],
            status: null,
            title: result.title
          });
          progress.set(index + 1, `${result.link} error`);
        }
      }
      progress.succeed(`Fetch complete: ${collectedPages.filter((page) => !page.error).length}/${collectedPages.length}`);

      const savedFiles = options.store
        ? [
            ...collectedPages.flatMap((page) => page.savedFiles),
            ...(await saveSearchArtifacts(
              storage.path,
              query,
              options.provider,
              searchResponse.results,
              searchResponse.browser
            )),
            ...(await saveCollectArtifacts(storage.path, {
              browser: searchResponse.browser,
              fetchedAt: new Date().toISOString(),
              provider: options.provider,
              query,
              results: collectedPages
            }))
          ]
        : [];

      if (options.json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              browser: searchResponse.browser,
              count: searchResponse.results.length,
              fetched: collectedPages,
              provider: options.provider,
              query,
              results: searchResponse.results,
              savedFiles,
              storage
            },
            null,
            2
          )}\n`
        );
        return;
      }

      const successCount = collectedPages.filter((page) => !page.error).length;
      printSection(`Collect: ${query}`);
      printMetric("Provider", options.provider);
      printMetric("Browser", formatBrowserRunInfo(searchResponse.browser));
      printMetric("Results", searchResponse.results.length);
      printMetric("Fetched", successCount);
      printMetric("Markdown", options.markdownEngine);
      printMetric("Storage", storage.path);

      collectedPages.forEach((page, index) => {
        const status = page.error ? "error" : page.status ?? "unknown";
        const target = page.finalUrl ?? page.link;
        console.log(`\n${index + 1}. [${status}] ${page.title}`);
        console.log(`   ${target}`);
        if (page.error) {
          console.log(`   ${page.error}`);
        }
      });

      printSavedFiles(savedFiles);
    } catch (error: unknown) {
      searchSpinner.fail(`Collect failed: ${query}`);
      throw error;
    }
  });
}
