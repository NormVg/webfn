import { InvalidArgumentError, Option } from "commander";
import type { Command } from "commander";

import type { BrowserEngineOption, BrowserLaunchOptions, NavigationWaitUntil } from "../core/browser.js";
import type { MarkdownEngine } from "../core/types.js";
import { resolveOutputDirectory } from "../core/config.js";

export type SharedCommandOptions = {
  chrome?: string;
  config?: string;
  delay: number;
  engine?: BrowserEngineOption;
  headed?: boolean;
  json?: boolean;
  lpPort: number;
  outputDir?: string;
  save: boolean;
  timeout: number;
  userAgent?: string;
};

export function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`Expected a positive integer, received "${value}"`);
  }

  return parsed;
}

export function parseNonNegativeInteger(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError(`Expected a non-negative integer, received "${value}"`);
  }

  return parsed;
}

export function addBrowserOptions(command: Command) {
  return command
    .option("--headed", "Run with a visible Chrome/Chromium window")
    .addOption(
      new Option("--engine <engine>", "Browser engine")
        .choices(["chrome", "lightpanda"] satisfies BrowserEngineOption[])
    )
    .option("--chrome <path>", "Path to Chrome/Chromium executable")
    .option("--timeout <ms>", "Navigation timeout in ms", parsePositiveInteger, 30_000)
    .option("--delay <ms>", "Post-load wait time in ms", parseNonNegativeInteger, 1_200)
    .option("--user-agent <ua>", "Custom user agent string")
    .option("--lp-port <port>", "Lightpanda CDP port", parsePositiveInteger, 9_222);
}

export function addOutputOptions(command: Command) {
  return command
    .option("--config <path>", "Path to webfn config file")
    .option("-o, --output-dir <dir>", "Output directory for artifacts")
    .option("--no-save", "Skip writing files to disk")
    .option("--json", "Force JSON output");
}

export async function resolveStorageOptions(options: SharedCommandOptions) {
  const outputOptions: { configPath?: string; outputDir?: string } = {};

  if (options.config) {
    outputOptions.configPath = options.config;
  }

  if (options.outputDir) {
    outputOptions.outputDir = options.outputDir;
  }

  return resolveOutputDirectory(outputOptions);
}

export function addWaitUntilOption(command: Command) {
  return command.addOption(
    new Option("--wait-until <mode>", "Navigation wait mode")
      .choices(["domcontentloaded", "networkidle2"] satisfies NavigationWaitUntil[])
      .default("networkidle2")
  );
}

export function addMarkdownEngineOption(command: Command) {
  return command.addOption(
    new Option("--md-engine <engine>", "Markdown extraction engine")
      .choices(["defuddle", "turndown"] satisfies MarkdownEngine[])
      .default("defuddle")
  );
}

export function toBrowserLaunchOptions(options: SharedCommandOptions): BrowserLaunchOptions {
  const launchOptions: BrowserLaunchOptions = {
    delayMs: options.delay,
    headless: !options.headed,
    lightpandaPort: options.lpPort,
    timeoutMs: options.timeout,
  };

  if (options.engine) {
    launchOptions.engine = options.engine;
  }

  if (options.chrome) {
    launchOptions.executablePath = options.chrome;
  }

  if (options.userAgent) {
    launchOptions.userAgent = options.userAgent;
  }

  return launchOptions;
}

export function shouldOutputJson(options: SharedCommandOptions) {
  return options.json === true || !process.stdout.isTTY;
}
