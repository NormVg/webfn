import chalk from "chalk";

import type { SavedFile } from "../core/storage.js";

const BANNER_LINES = [
  " __     __     ______     ______     ______   __   __",
  "/\\ \\  _ \\ \\   /\\  ___\\   /\\  == \\   /\\  ___\\ /\\ \"-.\\ \\",
  "\\ \\ \\/ \".\\ \\  \\ \\  __\\   \\ \\  __<   \\ \\  __\\ \\ \\ \\-.  \\",
  " \\ \\__/\".~\\_\\  \\ \\_____\\  \\ \\_____\\  \\ \\_\\    \\ \\_\\\\\"\\_\\",
  "  \\/_/   \\/_/   \\/_____/   \\/_____/   \\/_/     \\/_/ \\/_/"
];

export function renderBanner() {
  return BANNER_LINES.map((line) => chalk.cyanBright.bold(line)).join("\n");
}

export function renderRootIntro() {
  return [
    renderBanner(),
    chalk.dim("\nbrowser-backed search, fetch, crawl, and scrape\n"),
    ""
  ].join("\n");
}

export function printRootIntro() {
  console.log(renderRootIntro());
}

export function printSection(title: string) {
  console.log(chalk.bold.white(`\n${title}`));
  console.log(chalk.dim("─".repeat(Math.max(24, title.length + 2))));
}

export function printMetric(label: string, value: string | number) {
  console.log(`${chalk.cyan(label.padEnd(16))} ${chalk.white(String(value))}`);
}

export function printSavedFiles(files: SavedFile[]) {
  if (files.length === 0) {
    return;
  }

  printSection("Saved Files");
  for (const file of files) {
    console.log(`${chalk.green(">")} ${chalk.white(file.label)} ${chalk.dim(file.path)}`);
  }
}

export function printLabeledText(label: string, value: string) {
  console.log(`${chalk.cyan(label.padEnd(16))} ${value}`);
}
