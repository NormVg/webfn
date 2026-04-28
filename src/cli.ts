#!/usr/bin/env node

import { Command } from "commander";

import { registerCommands } from "./commands/index.js";

async function main() {
  const program = new Command();

  program
    .name("webfn")
    .description("Agent-oriented CLI for search, fetch, crawl, and scrape workflows")
    .version("0.1.0");
  program.showHelpAfterError();

  registerCommands(program);

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
