#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";

import { registerCommands } from "./commands/index.js";
import { renderRootIntro } from "./lib/ui.js";

async function main() {
  const program = new Command();

  program
    .name("webfn")
    .description("Agent-oriented CLI for search, fetch, crawl, and scrape workflows")
    .version("0.1.0");
  program.showHelpAfterError();
  program.configureHelp({
    subcommandTerm(command) {
      return chalk.cyan(command.name()) + chalk.dim(command.usage() ? ` ${command.usage()}` : "");
    }
  });
  program.addHelpText(
    "beforeAll",
    `${renderRootIntro()}${chalk.dim("Examples:")}\n  webfn search "openai agents"\n  webfn fetch https://example.com\n  webfn scrape https://example.com --markdown-engine turndown\n\n`
  );

  registerCommands(program);

  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
