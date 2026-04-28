import chalk from "chalk";
import readline from "node:readline";

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

const SPINNER_FRAMES = ["-", "\\", "|", "/"];

type LiveTextHandle = {
  fail: (message: string) => void;
  stop: () => void;
  succeed: (message: string) => void;
  update: (message: string) => void;
};

type ProgressHandle = LiveTextHandle & {
  advance: (step?: number, message?: string) => void;
  set: (current: number, message?: string) => void;
};

function createTerminalRenderer() {
  const interactive = Boolean(process.stdout.isTTY);
  let lastLength = 0;

  function render(message: string) {
    if (!interactive) {
      console.log(message);
      return;
    }

    readline.cursorTo(process.stdout, 0);
    process.stdout.write(message.padEnd(lastLength));
    lastLength = message.length;
  }

  function finish(message: string) {
    if (!interactive) {
      console.log(message);
      return;
    }

    readline.cursorTo(process.stdout, 0);
    process.stdout.write(message.padEnd(lastLength));
    process.stdout.write("\n");
    lastLength = 0;
  }

  function clear() {
    if (!interactive || lastLength === 0) {
      return;
    }

    readline.cursorTo(process.stdout, 0);
    process.stdout.write(" ".repeat(lastLength));
    readline.cursorTo(process.stdout, 0);
    lastLength = 0;
  }

  return {
    clear,
    finish,
    interactive,
    render
  };
}

export function startSpinner(initialMessage: string): LiveTextHandle {
  const terminal = createTerminalRenderer();
  let frameIndex = 0;
  let message = initialMessage;
  const renderFrame = () => terminal.render(`${chalk.cyan(SPINNER_FRAMES[frameIndex])} ${message}`);
  const interval = terminal.interactive
    ? setInterval(() => {
        frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
        renderFrame();
      }, 80)
    : null;

  renderFrame();

  return {
    fail(nextMessage: string) {
      if (interval) {
        clearInterval(interval);
      }
      terminal.finish(`${chalk.red("x")} ${nextMessage}`);
    },
    stop() {
      if (interval) {
        clearInterval(interval);
      }
      terminal.clear();
    },
    succeed(nextMessage: string) {
      if (interval) {
        clearInterval(interval);
      }
      terminal.finish(`${chalk.green("ok")} ${nextMessage}`);
    },
    update(nextMessage: string) {
      message = nextMessage;
      renderFrame();
    }
  };
}

function renderProgressBar(current: number, total: number) {
  const width = 24;
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(current / safeTotal, 1);
  const filled = Math.round(ratio * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

export function startProgress(label: string, total: number, initialMessage = ""): ProgressHandle {
  const terminal = createTerminalRenderer();
  let current = 0;
  let message = initialMessage;

  const renderFrame = () => {
    const bar = renderProgressBar(current, total);
    const prefix = `${chalk.cyan(bar)} ${chalk.white(`${current}/${Math.max(total, 1)}`)} ${chalk.bold(label)}`;
    terminal.render(message ? `${prefix} ${chalk.dim(message)}` : prefix);
  };

  renderFrame();

  return {
    advance(step = 1, nextMessage) {
      current = Math.min(total, current + step);
      if (nextMessage !== undefined) {
        message = nextMessage;
      }
      renderFrame();
    },
    fail(nextMessage: string) {
      terminal.finish(`${chalk.red("x")} ${nextMessage}`);
    },
    set(nextCurrent: number, nextMessage?: string) {
      current = Math.max(0, Math.min(total, nextCurrent));
      if (nextMessage !== undefined) {
        message = nextMessage;
      }
      renderFrame();
    },
    stop() {
      terminal.clear();
    },
    succeed(nextMessage: string) {
      terminal.finish(`${chalk.green("ok")} ${nextMessage}`);
    },
    update(nextMessage: string) {
      message = nextMessage;
      renderFrame();
    }
  };
}
