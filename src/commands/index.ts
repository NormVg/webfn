import type { Command } from "commander";

import { registerCollectCommand } from "./collect.js";
import { registerCrawlCommand } from "./crawl.js";
import { registerDoctorCommand } from "./doctor.js";
import { registerFetchCommand } from "./fetch.js";
import { registerSearchCommand } from "./search.js";
import { registerConfigCommand } from "./config.js";
import { registerScreenshotCommand } from "./screenshot.js";

export function registerCommands(program: Command) {
  registerSearchCommand(program);
  registerCollectCommand(program);
  registerFetchCommand(program);
  registerCrawlCommand(program);
  registerScreenshotCommand(program);
  registerConfigCommand(program);
  registerDoctorCommand(program);
}
