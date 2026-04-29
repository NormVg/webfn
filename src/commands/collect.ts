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
import {
  printKeyValueBox,
  printResultList,
  printSavedFiles,
  startProgress,
  startSpinner,
  writeJsonOutput,
} from "../lib/ui.js";
import {
  addBrowserOptions,
  addMarkdownEngineOption,
  addOutputOptions,
  addWaitUntilOption,
  parsePositiveInteger,
  resolveStorageOptions,
  shouldOutputJson,
  toBrowserLaunchOptions,
} from "./common.js";

type CollectCommandOptions = {
  chrome?: string;
  config?: string;
  delay: number;
  engine?: "chrome" | "lightpanda";
  headed?: boolean;
  html?: boolean;
  json?: boolean;
  lpPort: number;
  mdEngine: "defuddle" | "turndown";
  meta?: boolean;
  outputDir?: string;
  provider: SearchProvider;
  results: number;
  save: boolean;
  timeout: number;
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
    .description("Search, fetch each result, and save collected artifacts")
    .argument("<query>", "Search query")
    .option("-n, --results <count>", "Results to collect", parsePositiveInteger, 5)
    .addOption(
      new Option("--provider <provider>", "Search provider")
        .choices(["google", "duckduckgo"] satisfies SearchProvider[])
        .default("google")
    )
    .option("--html", "Also save rendered HTML for each page")
    .option("--meta", "Also save metadata JSON for each page");

  addBrowserOptions(command);
  addMarkdownEngineOption(command);
  addOutputOptions(command);
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
        timeoutMs: browserOptions.timeoutMs,
      });

      searchSpinner.succeed(`Found ${searchResponse.results.length} result(s)`);

      const collectedPages: CollectedPage[] = [];
      const progress = startProgress("Fetching", searchResponse.results.length, "Preparing");

      for (const [index, result] of searchResponse.results.entries()) {
        try {
          const snapshot = await fetchPageSnapshotWithEngine(browserOptions, result.link, {
            waitUntil: options.waitUntil,
          });
          const scrape = await buildScrapeResult(snapshot, {
            markdownEngine: options.mdEngine,
          });
          const savedFiles = options.save
            ? await saveFetchArtifacts(storage.path, snapshot, scrape, {
                saveHtml: Boolean(options.html),
                saveJson: Boolean(options.meta),
              })
            : [];
          progress.set(index + 1, resolvePreferredUrl(snapshot.finalUrl, snapshot.requestedUrl));

          collectedPages.push({
            error: null,
            finalUrl: resolvePreferredUrl(snapshot.finalUrl, snapshot.requestedUrl),
            link: result.link,
            savedFiles,
            status: snapshot.status,
            title: result.title,
          });
        } catch (error: unknown) {
          collectedPages.push({
            error: error instanceof Error ? error.message : String(error),
            finalUrl: null,
            link: result.link,
            savedFiles: [],
            status: null,
            title: result.title,
          });
          progress.set(index + 1, `${result.link} (error)`);
        }
      }

      const successCount = collectedPages.filter((p) => !p.error).length;
      progress.succeed(`Fetched ${successCount}/${collectedPages.length} pages`);

      const savedFiles = options.save
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
              results: collectedPages,
            })),
          ]
        : [];

      if (shouldOutputJson(options)) {
        writeJsonOutput({
          ok: true,
          command: "collect",
          query,
          provider: options.provider,
          browser: searchResponse.browser,
          results: searchResponse.results,
          fetched: collectedPages,
          files: savedFiles,
          storage,
        });
        return;
      }

      const actualProvider = searchResponse.results[0]?.provider ?? options.provider;

      printKeyValueBox(`Collect: ${query}`, [
        { key: "Provider", value: actualProvider },
        { key: "Engine", value: formatBrowserRunInfo(searchResponse.browser) },
        { key: "Results", value: searchResponse.results.length },
        { key: "Fetched", value: successCount },
        { key: "Markdown", value: options.mdEngine },
        { key: "Storage", value: storage.path },
      ]);

      printResultList(
        "Pages",
        collectedPages.map((p) => ({
          title: p.title,
          url: p.finalUrl ?? p.link,
          status: p.status,
          error: p.error,
        }))
      );

      printSavedFiles(savedFiles);
    } catch (error: unknown) {
      searchSpinner.fail(`Collect failed: ${query}`);
      throw error;
    }
  });
}
