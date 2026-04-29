import type { Command } from "commander";
import chalk from "chalk";

import type { NavigationWaitUntil } from "../core/browser.js";
import { formatBrowserRunInfo } from "../core/browser.js";
import { fetchPageSnapshotWithEngine, summarizePageSnapshot } from "../core/fetcher.js";
import { buildScrapeResult } from "../core/parser.js";
import { saveFetchArtifacts } from "../core/storage.js";
import {
  printKeyValueBox,
  printSavedFiles,
  printSection,
  startSpinner,
  writeJsonOutput,
} from "../lib/ui.js";
import { resolvePreferredUrl } from "../lib/url.js";
import {
  addBrowserOptions,
  addMarkdownEngineOption,
  addOutputOptions,
  addWaitUntilOption,
  mergeConfigDefaults,
  resolveStorageOptions,
  shouldOutputJson,
  toBrowserLaunchOptions,
} from "./common.js";

type FetchCommandOptions = {
  chrome?: string;
  config?: string;
  delay: number;
  engine?: "chrome" | "lightpanda";
  frontmatter: boolean;
  headed?: boolean;
  html?: boolean;
  json?: boolean;
  lpPort: number;
  mdEngine: "defuddle" | "turndown";
  meta?: boolean;
  outputDir?: string;
  save: boolean;
  stdout?: boolean;
  timeout: number;
  userAgent?: string;
  waitUntil: NavigationWaitUntil;
};

export function registerFetchCommand(program: Command) {
  const command = program
    .command("fetch")
    .description("Load a page and extract readable markdown with optional metadata")
    .argument("<url>", "Page URL")
    .option("--no-frontmatter", "Omit YAML frontmatter from the saved markdown")
    .option("--html", "Also save rendered HTML")
    .option("--meta", "Also save metadata JSON")
    .option("--stdout", "Print extracted markdown to stdout");

  addBrowserOptions(command);
  addMarkdownEngineOption(command);
  addOutputOptions(command);
  addWaitUntilOption(command);

  command.action(async (url: string, rawOptions: FetchCommandOptions, cmd) => {
    const options = await mergeConfigDefaults(rawOptions, cmd);
    const spinner = startSpinner(`Fetching ${url}`);

    try {
      const browserOptions = toBrowserLaunchOptions(options);
      const storage = await resolveStorageOptions(options);
      const snapshot = await fetchPageSnapshotWithEngine(browserOptions, url, {
        waitUntil: options.waitUntil,
      });
      const summary = summarizePageSnapshot(snapshot);
      const scrape = await buildScrapeResult(snapshot, {
        markdownEngine: options.mdEngine,
      });
      const displayUrl = resolvePreferredUrl(snapshot.finalUrl, snapshot.requestedUrl);
      const savedFiles = options.save
        ? await saveFetchArtifacts(storage.path, snapshot, scrape, {
            frontmatter: options.frontmatter,
            saveHtml: Boolean(options.html),
            saveJson: Boolean(options.meta),
          })
        : [];

      spinner.succeed(`Fetched ${displayUrl}`);

      if (shouldOutputJson(options)) {
        writeJsonOutput({
          ok: true,
          command: "fetch",
          page: {
            title: summary.title,
            description: summary.description,
            url: displayUrl,
            requestedUrl: snapshot.requestedUrl,
            finalUrl: snapshot.finalUrl,
            status: summary.status,
            headings: summary.headings,
            links: summary.links,
            media: summary.media,
            htmlBytes: summary.htmlLength,
            markdownBytes: scrape.markdown.length,
            markdownEngine: scrape.markdownEngine,
            wordCount: scrape.wordCount,
          },
          browser: snapshot.browser,
          files: savedFiles,
          storage,
        });
        return;
      }

      printKeyValueBox(summary.title ?? "Fetched Page", [
        { key: "URL", value: displayUrl },
        { key: "Status", value: summary.status },
        { key: "Engine", value: formatBrowserRunInfo(snapshot.browser) },
        { key: "Markdown", value: scrape.markdownEngine },
        { key: "Words", value: scrape.wordCount },
        { key: "Headings", value: summary.headings },
        { key: "Links", value: summary.links },
        { key: "Media", value: summary.media },
        { key: "HTML bytes", value: summary.htmlLength.toLocaleString() },
        { key: "MD bytes", value: scrape.markdown.length.toLocaleString() },
      ]);

      if (summary.description) {
        console.log(`\n  ${chalk.dim.italic(summary.description)}`);
      }

      if (options.stdout) {
        printSection("Markdown");
        process.stdout.write(`${scrape.markdown.trim()}\n`);
      }

      printSavedFiles(savedFiles);
    } catch (error: unknown) {
      spinner.fail(`Fetch failed: ${url}`);
      throw error;
    }
  });
}
