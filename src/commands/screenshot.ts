import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";

import { addBrowserOptions, toBrowserLaunchOptions } from "./common.js";
import { loadConfig, resolveOutputDirectory } from "../core/config.js";
import { withBrowserSession } from "../core/browser.js";
import { slugify } from "../lib/text.js";
import { canonicalizeUrl } from "../lib/url.js";
import { startSpinner } from "../lib/ui.js";
import type { BrowserEngineOption } from "../core/browser.js";

type ScreenshotCommandOptions = {
  chrome?: string;
  config?: string;
  delay: number;
  engine?: BrowserEngineOption;
  headed: boolean;
  lpPort: number;
  outputDir?: string;
  save: boolean;
  timeout: number;
  userAgent?: string;
  waitUntil: string;
  full: boolean;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
};

export function registerScreenshotCommand(program: Command) {
  const command = program
    .command("screenshot")
    .description("Take a screenshot of a website")
    .argument("<url>", "URL to screenshot")
    .option("--full", "Take a full page screenshot", false)
    .option("-o, --output-dir <dir>", "Output directory for the screenshot")
    .action(async (url: string, options: ScreenshotCommandOptions) => {
      const spinner = startSpinner(`Preparing to take screenshot of ${url}`);
      try {
        const loadedConfig = await loadConfig(options.config);
        const config = loadedConfig?.config || {};
        const browserOptions = toBrowserLaunchOptions(options);

        // Map options back to config settings if needed
        if (config.engine && !options.engine) {
          browserOptions.engine = config.engine;
        }

        const outDirResolve = await resolveOutputDirectory({
          ...(options.config ? { configPath: options.config } : {}),
          ...(options.outputDir ? { outputDir: options.outputDir } : {}),
        });
        const outDir = path.join(outDirResolve.path, "screenshots");
        await fs.mkdir(outDir, { recursive: true });

        const normalizedUrl = canonicalizeUrl(url);
        if (!normalizedUrl) {
          throw new Error(`Invalid URL provided: ${url}`);
        }

        const filename = `${slugify(new URL(normalizedUrl).hostname)}-${Date.now()}.png`;
        const outputPath = path.join(outDir, filename);

        if (browserOptions.engine === "cloudflare") {
          spinner.update(`Taking screenshot using Cloudflare Browser Rendering...`);

          if (options.full) {
            console.warn(chalk.yellow(`\n⚠ Warning: Cloudflare REST API does not support full-page screenshots. Taking a viewport screenshot instead.`));
          }

          const accountId = browserOptions.cloudflareAccountId;
          const apiToken = browserOptions.cloudflareApiToken;

          if (!accountId || !apiToken) {
            throw new Error(
              "Cloudflare credentials missing. Set CLOUDFLARE_ACC_ID and CLOUDFLARE_TOKEN in .env or configure them in webfn.config.json."
            );
          }

          const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiToken}`,
              },
              body: JSON.stringify({
                url: normalizedUrl,
              }),
            }
          );

          if (!res.ok) {
            let errorMsg = `Cloudflare Browser Rendering failed: HTTP ${res.status}`;
            try {
              const errorJson = await res.json();
              if (errorJson.errors && errorJson.errors.length > 0) {
                errorMsg += ` - ${errorJson.errors[0].message}`;
              }
            } catch {
              // Ignore
            }
            throw new Error(errorMsg);
          }

          const arrayBuffer = await res.arrayBuffer();
          await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
        } else {
          spinner.update(`Launching ${browserOptions.engine} browser...`);

          await withBrowserSession(browserOptions, async ({ page }) => {
            spinner.update(`Navigating to ${normalizedUrl}...`);
            
            await page.goto(normalizedUrl, {
              timeout: browserOptions.timeoutMs,
              waitUntil: options.waitUntil as any,
            });

            if (browserOptions.delayMs > 0) {
              spinner.update(`Waiting ${browserOptions.delayMs}ms...`);
              await new Promise((resolve) => setTimeout(resolve, browserOptions.delayMs));
            }

            spinner.update(`Capturing screenshot...`);
            await page.screenshot({
              path: outputPath,
              fullPage: options.full,
            });
          });
        }

        spinner.succeed(`Screenshot saved to ${outputPath}`);
      } catch (error: unknown) {
        spinner.fail(`Screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
      }
    });

  addBrowserOptions(command);

  // Add the basic options that addBrowserOptions does not cover but are in shared
  command.option("--wait-until <mode>", "Navigation wait mode", "networkidle2");
}
