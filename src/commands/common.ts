import { InvalidArgumentError, Option } from "commander";
import type { Command } from "commander";

import type { BrowserEngineOption, BrowserLaunchOptions, NavigationWaitUntil } from "../core/browser.js";
import type { MarkdownEngine } from "../core/types.js";
import { loadConfig, resolveOutputDirectory, type WebfnConfig } from "../core/config.js";

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
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
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
        .choices(["chrome", "lightpanda", "cloudflare"] satisfies BrowserEngineOption[])
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

/**
 * Load config defaults and merge with CLI-provided options.
 * CLI flags always take priority over config values.
 */
export async function mergeConfigDefaults<T extends SharedCommandOptions>(
  options: T,
  command: Command
): Promise<T> {
  const loaded = await loadConfig(options.config);
  if (!loaded) return options;

  const cfg = loaded.config;
  const merged = { ...options };

  // Only apply config defaults for options NOT explicitly provided on the CLI
  const explicitlySet = (name: string) => {
    const opt = command.getOptionValueSource(name);
    return opt === "cli";
  };

  if (cfg.timeout && !explicitlySet("timeout")) {
    merged.timeout = cfg.timeout;
  }

  if (cfg.delay !== undefined && !explicitlySet("delay")) {
    merged.delay = cfg.delay;
  }

  if (cfg.engine && !explicitlySet("engine")) {
    merged.engine = cfg.engine as BrowserEngineOption;
  }

  if (cfg.waitUntil && !explicitlySet("waitUntil")) {
    (merged as Record<string, unknown>).waitUntil = cfg.waitUntil;
  }

  if (cfg.mdEngine && !explicitlySet("mdEngine")) {
    (merged as Record<string, unknown>).mdEngine = cfg.mdEngine;
  }

  if (cfg.provider && !explicitlySet("provider")) {
    (merged as Record<string, unknown>).provider = cfg.provider;
  }

  if (cfg.results && !explicitlySet("results")) {
    (merged as Record<string, unknown>).results = cfg.results;
  }

  if (cfg.cloudflareAccountId && !explicitlySet("cloudflareAccountId")) {
    (merged as Record<string, unknown>).cloudflareAccountId = cfg.cloudflareAccountId;
  }

  if (cfg.cloudflareApiToken && !explicitlySet("cloudflareApiToken")) {
    (merged as Record<string, unknown>).cloudflareApiToken = cfg.cloudflareApiToken;
  }

  return merged;
}

export function toBrowserLaunchOptions(options: SharedCommandOptions): BrowserLaunchOptions {
  const launchOptions: BrowserLaunchOptions = {
    delayMs: options.delay,
    headless: !options.headed,
    lightpandaPort: options.lpPort,
    timeoutMs: options.timeout,
  };

  const accountId = options.cloudflareAccountId ?? process.env.CLOUDFLARE_ACC_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  if (accountId) {
    launchOptions.cloudflareAccountId = accountId;
  }

  const apiToken = options.cloudflareApiToken ?? process.env.CLOUDFLARE_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
  if (apiToken) {
    launchOptions.cloudflareApiToken = apiToken;
  }

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
