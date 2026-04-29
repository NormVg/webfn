import { Command } from "commander";
import chalk from "chalk";

import { DEFAULT_CONFIG_FILE, loadConfig, writeConfig } from "../core/config.js";
import { printKeyValueBox, printSection, writeJsonOutput } from "../lib/ui.js";

export function registerConfigCommand(program: Command) {
  const configCmd = program
    .command("config")
    .description("Manage webfn configuration file");

  configCmd
    .command("init")
    .description("Create a new webfn.config.json file in the current directory")
    .option("--json", "Force JSON output")
    .action(async (options: { json?: boolean }) => {
      const existing = await loadConfig();
      if (existing) {
        if (options.json || !process.stdout.isTTY) {
          writeJsonOutput({ ok: false, error: "Config file already exists", path: existing.path });
        } else {
          console.error(chalk.red(`✖ Config file already exists at ${existing.path}`));
        }
        process.exitCode = 1;
        return;
      }

      const path = await writeConfig({ outputDir: "data" });
      
      if (options.json || !process.stdout.isTTY) {
        writeJsonOutput({ ok: true, command: "config init", path });
        return;
      }

      printSection("Configuration");
      console.log(`${chalk.green("✔")} Created new config file at ${chalk.dim(path)}`);
    });

  configCmd
    .command("show")
    .description("Show the current configuration")
    .option("--json", "Force JSON output")
    .action(async (options: { json?: boolean }) => {
      const loaded = await loadConfig();

      if (!loaded) {
        if (options.json || !process.stdout.isTTY) {
          writeJsonOutput({ ok: true, command: "config show", config: null, path: null });
        } else {
          console.log(chalk.dim(`No ${DEFAULT_CONFIG_FILE} found in current directory.`));
        }
        return;
      }

      if (options.json || !process.stdout.isTTY) {
        writeJsonOutput({ ok: true, command: "config show", config: loaded.config, path: loaded.path });
        return;
      }

      printKeyValueBox(`Config: ${loaded.path}`, [
        { key: "outputDir", value: loaded.config.outputDir },
      ]);
    });

  configCmd
    .command("get <key>")
    .description("Get a configuration value")
    .option("--json", "Force JSON output")
    .action(async (key: string, options: { json?: boolean }) => {
      const loaded = await loadConfig();
      if (!loaded) {
        if (options.json || !process.stdout.isTTY) {
          writeJsonOutput({ ok: false, error: "No config file found" });
        } else {
          console.error(chalk.red(`✖ No ${DEFAULT_CONFIG_FILE} found. Run 'webfn config init' first.`));
        }
        process.exitCode = 1;
        return;
      }

      const value = loaded.config[key as keyof typeof loaded.config];

      if (options.json || !process.stdout.isTTY) {
        writeJsonOutput({ ok: true, command: "config get", key, value });
        return;
      }

      if (value === undefined) {
        console.log(chalk.dim("–"));
      } else {
        console.log(value);
      }
    });

  configCmd
    .command("set <key> <value>")
    .description("Set a configuration value")
    .option("--json", "Force JSON output")
    .action(async (key: string, value: string, options: { json?: boolean }) => {
      let loaded = await loadConfig();
      let config = loaded?.config ?? {};
      
      if (key === "outputDir") {
        config.outputDir = value;
      } else {
        if (options.json || !process.stdout.isTTY) {
          writeJsonOutput({ ok: false, error: `Unknown configuration key: ${key}` });
        } else {
          console.error(chalk.red(`✖ Unknown configuration key: ${key}`));
        }
        process.exitCode = 1;
        return;
      }

      const path = await writeConfig(config);

      if (options.json || !process.stdout.isTTY) {
        writeJsonOutput({ ok: true, command: "config set", key, value, path });
        return;
      }

      console.log(`${chalk.green("✔")} Set ${chalk.hex("#8B5CF6")(key)} to ${chalk.white(value)}`);
    });
}
