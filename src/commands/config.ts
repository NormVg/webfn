import { Command } from "commander";
import chalk from "chalk";

import {
  DEFAULT_CONFIG_FILE,
  getConfigKeyType,
  isValidConfigKey,
  loadConfig,
  writeConfig,
  type WebfnConfig,
} from "../core/config.js";
import { printKeyValueBox, printSection, writeJsonOutput } from "../lib/ui.js";

const ALL_CONFIG_KEYS: (keyof WebfnConfig)[] = [
  "outputDir",
  "provider",
  "mdEngine",
  "timeout",
  "delay",
  "results",
  "waitUntil",
  "engine",
];

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

      const defaultConfig: WebfnConfig = {
        outputDir: "data",
        provider: "google",
        mdEngine: "defuddle",
        timeout: 30000,
        delay: 1200,
        results: 5,
        waitUntil: "networkidle2",
      };

      const path = await writeConfig(defaultConfig);
      
      if (options.json || !process.stdout.isTTY) {
        writeJsonOutput({ ok: true, command: "config init", path, config: defaultConfig });
        return;
      }

      printSection("Configuration");
      console.log(`${chalk.green("✔")} Created config at ${chalk.dim(path)}`);
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
          console.log(chalk.dim(`No ${DEFAULT_CONFIG_FILE} found. Run 'webfn config init' to create one.`));
        }
        return;
      }

      if (options.json || !process.stdout.isTTY) {
        writeJsonOutput({ ok: true, command: "config show", config: loaded.config, path: loaded.path });
        return;
      }

      const entries = ALL_CONFIG_KEYS.map((key) => ({
        key,
        value: loaded.config[key] as string | number | undefined,
      }));

      printKeyValueBox(`Config: ${loaded.path}`, entries);
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

      if (!isValidConfigKey(key)) {
        const msg = `Unknown key: "${key}". Valid keys: ${ALL_CONFIG_KEYS.join(", ")}`;
        if (options.json || !process.stdout.isTTY) {
          writeJsonOutput({ ok: false, error: msg });
        } else {
          console.error(chalk.red(`✖ ${msg}`));
        }
        process.exitCode = 1;
        return;
      }

      const value = loaded.config[key];

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
      if (!isValidConfigKey(key)) {
        const msg = `Unknown key: "${key}". Valid keys: ${ALL_CONFIG_KEYS.join(", ")}`;
        if (options.json || !process.stdout.isTTY) {
          writeJsonOutput({ ok: false, error: msg });
        } else {
          console.error(chalk.red(`✖ ${msg}`));
        }
        process.exitCode = 1;
        return;
      }

      let loaded = await loadConfig();
      let config = loaded?.config ?? {};

      const keyType = getConfigKeyType(key);
      if (keyType === "number") {
        const numVal = Number(value);
        if (Number.isNaN(numVal) || numVal <= 0) {
          const msg = `"${key}" must be a positive number, got "${value}"`;
          if (options.json || !process.stdout.isTTY) {
            writeJsonOutput({ ok: false, error: msg });
          } else {
            console.error(chalk.red(`✖ ${msg}`));
          }
          process.exitCode = 1;
          return;
        }
        (config as Record<string, unknown>)[key] = numVal;
      } else {
        (config as Record<string, unknown>)[key] = value;
      }

      const path = await writeConfig(config);

      if (options.json || !process.stdout.isTTY) {
        writeJsonOutput({ ok: true, command: "config set", key, value: (config as Record<string, unknown>)[key], path });
        return;
      }

      console.log(`${chalk.green("✔")} Set ${chalk.hex("#8B5CF6")(key)} = ${chalk.white(String((config as Record<string, unknown>)[key]))}`);
    });
}
