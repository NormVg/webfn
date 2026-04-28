import type { Command } from "commander";

import { registerCollectCommand } from "./collect.js";
import { registerCrawlCommand } from "./crawl.js";
import { registerDoctorCommand } from "./doctor.js";
import { registerFetchCommand } from "./fetch.js";
import { registerScrapeCommand } from "./scrape.js";
import { registerSearchCommand } from "./search.js";

export function registerCommands(program: Command) {
  registerSearchCommand(program);
  registerCollectCommand(program);
  registerFetchCommand(program);
  registerCrawlCommand(program);
  registerScrapeCommand(program);
  registerDoctorCommand(program);
}
