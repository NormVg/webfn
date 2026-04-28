import type { Command } from "commander";
import path from "node:path";

import { detectLightpandaAvailability, findChromeExecutable } from "../core/browser.js";
import { logger } from "../lib/logger.js";

type DoctorOptions = {
  json?: boolean;
};

export function registerDoctorCommand(program: Command) {
  program
    .command("doctor")
    .description("Print local runtime and browser capability details")
    .option("--json", "Output machine-readable JSON")
    .action(async (options: DoctorOptions) => {
      const chromeExecutable = findChromeExecutable();
      const lightpandaAvailable = await detectLightpandaAvailability();
      const details = {
        cli: "webfn",
        node: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        packageManager: "pnpm",
        chromeExecutable,
        lightpandaAvailable,
        headlessDefaultEngine: "lightpanda",
        headedDefaultEngine: "chrome",
        defaultOutputDir: path.resolve("data"),
        timestamp: new Date().toISOString()
      };

      if (options.json) {
        process.stdout.write(`${JSON.stringify(details, null, 2)}\n`);
        return;
      }

      logger.info(`CLI: ${details.cli}`);
      logger.info(`Node: ${details.node}`);
      logger.info(`Platform: ${details.platform}`);
      logger.info(`CWD: ${details.cwd}`);
      logger.info(`Package manager: ${details.packageManager}`);
      logger.info(`Chrome: ${details.chromeExecutable ?? "not found"}`);
      logger.info(`Lightpanda module: ${details.lightpandaAvailable ? "available" : "not installed"}`);
      logger.info(`Headless default: ${details.headlessDefaultEngine}`);
      logger.info(`Headed default: ${details.headedDefaultEngine}`);
      logger.info(`Output dir: ${details.defaultOutputDir}`);
      logger.info(`Timestamp: ${details.timestamp}`);
    });
}
