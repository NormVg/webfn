#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";

import { registerCommands } from "./commands/index.js";
import { renderRootIntro } from "./lib/ui.js";

async function main() {
  const program = new Command();

  program
    .name("webfn")
    .description("Agent-oriented CLI for search, fetch, and crawl workflows")
    .version("0.1.0");

  program.showHelpAfterError();

  program.configureHelp({
    subcommandTerm(command) {
      return chalk.hex("#8B5CF6")(command.name()) + chalk.dim(command.usage() ? ` ${command.usage()}` : "");
    },
  });

  program.addHelpText(
    "beforeAll",
    `${renderRootIntro()}${chalk.dim("Examples:")}\n  webfn search "openai agents"\n  webfn fetch https://example.com\n  webfn fetch https://example.com --stdout --no-frontmatter\n\n`
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
  console.error(chalk.red(`\n✖ ${message}`));
  process.exitCode = 1;
});
