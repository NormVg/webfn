import type { Command } from "commander";
import chalk from "chalk";

import { detectLightpandaAvailability, findChromeExecutable } from "../core/browser.js";
import { resolveOutputDirectory } from "../core/config.js";
import { printKeyValueBox, writeJsonOutput } from "../lib/ui.js";

type DoctorOptions = {
  config?: string;
  json?: boolean;
};

export function registerDoctorCommand(program: Command) {
  program
    .command("doctor")
    .description("Check runtime environment and browser availability")
    .option("--config <path>", "Path to webfn config file")
    .option("--json", "Output machine-readable JSON")
    .action(async (options: DoctorOptions) => {
      const chromeExecutable = findChromeExecutable();
      const lightpandaAvailable = await detectLightpandaAvailability();
      const storage = await resolveOutputDirectory(options.config ? { configPath: options.config } : {});

      const details = {
        cli: "webfn",
        version: "0.1.0",
        node: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        chrome: chromeExecutable,
        lightpanda: lightpandaAvailable,
        defaultHeadless: "lightpanda",
        defaultHeaded: "chrome",
        storage,
        timestamp: new Date().toISOString(),
      };

      if (options.json || !process.stdout.isTTY) {
        writeJsonOutput({ ok: true, command: "doctor", ...details });
        return;
      }

      printKeyValueBox("Environment", [
        { key: "CLI", value: `${details.cli} ${details.version}` },
        { key: "Node", value: details.node },
        { key: "Platform", value: details.platform },
        { key: "CWD", value: details.cwd },
      ]);

      const chromeStatus = details.chrome
        ? chalk.green("found")
        : chalk.red("not found");
      const lpStatus = details.lightpanda
        ? chalk.green("available")
        : chalk.red("not installed");

      printKeyValueBox("Browsers", [
        { key: "Chrome", value: details.chrome ? `${chromeStatus} ${chalk.dim(details.chrome)}` : chromeStatus },
        { key: "Lightpanda", value: lpStatus },
        { key: "Headless default", value: details.defaultHeadless },
        { key: "Headed default", value: details.defaultHeaded },
      ]);

      printKeyValueBox("Storage", [
        { key: "Output dir", value: `${storage.path} (${storage.source})` },
        { key: "Config", value: storage.configPath ?? chalk.dim("none") },
      ]);
    });
}
