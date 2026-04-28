import { InvalidArgumentError, Option } from "commander";
import type { Command } from "commander";

import type { BrowserEngineOption, BrowserLaunchOptions, NavigationWaitUntil } from "../core/browser.js";

export type SharedCommandOptions = {
  chrome?: string;
  delayMs: number;
  engine?: BrowserEngineOption;
  headed?: boolean;
  lightpandaPort: number;
  outputDir: string;
  store: boolean;
  timeoutMs: number;
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
      new Option(
        "--engine <engine>",
        "Browser engine override. By default headless uses Lightpanda and headed uses Chrome."
      )
        .choices(["chrome", "lightpanda"] satisfies BrowserEngineOption[])
    )
    .option("--chrome <path>", "Path to a Chrome/Chromium executable")
    .option("--timeout-ms <ms>", "Navigation timeout in milliseconds", parsePositiveInteger, 30_000)
    .option("--delay-ms <ms>", "Extra wait time after page load in milliseconds", parseNonNegativeInteger, 1_200)
    .option("--user-agent <ua>", "Override the default user agent")
    .option("--lightpanda-port <port>", "CDP port used when engine=lightpanda", parsePositiveInteger, 9_222);
}

export function addStorageOptions(command: Command) {
  return command
    .option("-o, --output-dir <dir>", "Directory used for saved artifacts", "data")
    .option("--no-store", "Skip writing files and print only to stdout");
}

export function addWaitUntilOption(command: Command) {
  return command.addOption(
    new Option("--wait-until <mode>", "Navigation wait mode")
      .choices(["domcontentloaded", "networkidle2"] satisfies NavigationWaitUntil[])
      .default("networkidle2")
  );
}

export function toBrowserLaunchOptions(options: SharedCommandOptions): BrowserLaunchOptions {
  const launchOptions: BrowserLaunchOptions = {
    delayMs: options.delayMs,
    headless: !options.headed,
    lightpandaPort: options.lightpandaPort,
    timeoutMs: options.timeoutMs
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
