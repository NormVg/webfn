import chalk from "chalk";
import readline from "node:readline";
import path from "node:path";

import type { SavedFile } from "../core/storage.js";

// ── Detection ───────────────────────────────────────────────────────────────

const isTTY = Boolean(process.stdout.isTTY);

export function isInteractive() {
  return isTTY;
}

export function formatPath(filePath: string) {
  if (typeof filePath !== "string") return filePath;
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    return "." + path.sep + path.relative(cwd, filePath);
  }
  return filePath;
}

// ── Symbols ─────────────────────────────────────────────────────────────────

const S = {
  ok: isTTY ? chalk.green("✔") : chalk.green("ok"),
  fail: isTTY ? chalk.red("✖") : chalk.red("x"),
  bullet: isTTY ? chalk.dim("▸") : chalk.dim(">"),
  dot: isTTY ? chalk.dim("·") : chalk.dim("."),
  bar: isTTY ? "│" : "|",
  dash: isTTY ? "─" : "-",
} as const;

// ── Banner ──────────────────────────────────────────────────────────────────

const BANNER = [
  " _       __     __    ______",
  "| |     / /__  / /_  / ____/___",
  "| | /| / / _ \\/ __ \\/ /_  / __ \\",
  "| |/ |/ /  __/ /_/ / __/ / / / /",
  "|__/|__/\\___/_.___/_/   /_/ /_/",
];

export function renderBanner() {
  return BANNER.map((line) => chalk.bold.hex("#8B5CF6")(line)).join("\n");
}

export function renderTagline() {
  return chalk.dim("\nagent-oriented search · fetch · crawl");
}

export function renderVersion() {
  return chalk.dim("v0.1.0");
}

export function renderRootIntro() {
  if (!isTTY) {
    return "";
  }

  return [
    "",
    renderBanner(),
    `  ${renderTagline()}  ${renderVersion()}`,
    "",
    "",
  ].join("\n");
}

export function printRootIntro() {
  if (isTTY) {
    console.log(renderRootIntro());
  }
}

// ── Sections ────────────────────────────────────────────────────────────────

export function printSection(title: string) {
  console.log("");
  console.log(chalk.bold.white(` ${title}`));
  console.log(chalk.dim(` ${S.dash.repeat(Math.max(32, title.length + 4))}`));
}

// ── Key-Value Output ────────────────────────────────────────────────────────

export function printMetric(label: string, value: string | number | null | undefined) {
  const displayValue = value === null || value === undefined ? chalk.dim("–") : String(value);
  console.log(
    `  ${chalk.hex("#8B5CF6")(label.padEnd(16))} ${chalk.white(displayValue)}`
  );
}

// ── Tables ──────────────────────────────────────────────────────────────────

export function printKeyValueBox(
  title: string,
  entries: Array<{ key: string; value: string | number | null | undefined }>
) {
  console.log("");
  console.log(chalk.bold.white(` ${title}`));
  console.log(chalk.dim(` ${S.dash.repeat(Math.max(32, title.length + 4))}`));

  const maxKeyLength = Math.max(...entries.map((e) => e.key.length));

  for (const entry of entries) {
    let rawValue = entry.value;
    if (typeof rawValue === "string" && rawValue.startsWith("/")) {
      rawValue = formatPath(rawValue);
    }
    
    const displayValue =
      rawValue === null || rawValue === undefined
        ? chalk.dim("–")
        : chalk.white(String(rawValue));
        
    console.log(` ${chalk.hex("#8B5CF6")(entry.key.padEnd(maxKeyLength))}   ${displayValue}`);
  }
}

// ── Result Lists ────────────────────────────────────────────────────────────

export type ResultItem = {
  status?: string | number | null;
  title: string;
  url?: string;
  detail?: string;
  error?: string | null;
};

export function printResultList(title: string, items: ResultItem[], max = 15) {
  if (items.length === 0) {
    return;
  }

  console.log("");
  console.log(chalk.bold.white(` ${title}`));
  console.log(chalk.dim(` ${S.dash.repeat(Math.max(32, title.length + 4))}`));

  const display = items.slice(0, max);

  for (const [index, item] of display.entries()) {
    const num = chalk.dim(String(index + 1).padStart(3) + ".");
    const statusBadge =
      item.error
        ? chalk.red(" ERR ")
        : item.status
          ? chalk.dim(`[${item.status}]`)
          : "";

    console.log(`${num} ${chalk.white(item.title)} ${statusBadge}`);

    if (item.url) {
      console.log(`     ${chalk.dim(item.url)}`);
    }

    if (item.detail) {
      console.log(`     ${chalk.dim.italic(item.detail)}`);
    }

    if (item.error) {
      console.log(`     ${chalk.red(item.error)}`);
    }
  }

  if (items.length > max) {
    console.log(chalk.dim(`     … and ${items.length - max} more`));
  }
}

// ── Saved Files ─────────────────────────────────────────────────────────────

export function printSavedFiles(files: SavedFile[]) {
  if (files.length === 0) {
    return;
  }

  console.log("");
  console.log(chalk.bold.white(` Saved Files`));
  console.log(chalk.dim(` ${S.dash.repeat(32)}`));

  const maxLabelLength = Math.max(...files.map((f) => f.label.length));

  for (const file of files) {
    console.log(` ${S.bullet} ${chalk.hex("#8B5CF6")(file.label.padEnd(maxLabelLength))}   ${chalk.dim(formatPath(file.path))}`);
  }
}

// ── Spinner ─────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = isTTY
  ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  : ["-", "\\", "|", "/"];

export type LiveTextHandle = {
  fail: (message: string) => void;
  stop: () => void;
  succeed: (message: string) => void;
  update: (message: string) => void;
};

export type ProgressHandle = LiveTextHandle & {
  advance: (step?: number, message?: string) => void;
  set: (current: number, message?: string) => void;
};

function createTerminalRenderer() {
  const interactive = isTTY;
  let lastLength = 0;

  function render(message: string) {
    if (!interactive) {
      return;
    }

    readline.clearLine(process.stderr, 0);
    readline.cursorTo(process.stderr, 0);
    process.stderr.write(message);
    lastLength = message.length;
  }

  function finish(message: string) {
    if (!interactive) {
      console.error(message);
      return;
    }

    readline.clearLine(process.stderr, 0);
    readline.cursorTo(process.stderr, 0);
    process.stderr.write(message);
    process.stderr.write("\n");
    lastLength = 0;
  }

  function clear() {
    if (!interactive || lastLength === 0) {
      return;
    }

    readline.clearLine(process.stderr, 0);
    readline.cursorTo(process.stderr, 0);
    lastLength = 0;
  }

  return { clear, finish, interactive, render };
}

export function startSpinner(initialMessage: string): LiveTextHandle {
  const terminal = createTerminalRenderer();
  let frameIndex = 0;
  let message = initialMessage;

  const renderFrame = () =>
    terminal.render(`${chalk.hex("#8B5CF6")(SPINNER_FRAMES[frameIndex])} ${chalk.dim(message)}`);

  const interval = terminal.interactive
    ? setInterval(() => {
        frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
        renderFrame();
      }, 80)
    : null;

  renderFrame();

  return {
    fail(nextMessage: string) {
      if (interval) clearInterval(interval);
      terminal.finish(`${S.fail} ${nextMessage}`);
    },
    stop() {
      if (interval) clearInterval(interval);
      terminal.clear();
    },
    succeed(nextMessage: string) {
      if (interval) clearInterval(interval);
      terminal.finish(`${S.ok} ${nextMessage}`);
    },
    update(nextMessage: string) {
      message = nextMessage;
      renderFrame();
    },
  };
}

// ── Progress ────────────────────────────────────────────────────────────────

function renderProgressBar(current: number, total: number) {
  const width = 20;
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(current / safeTotal, 1);
  const filled = Math.round(ratio * width);
  const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
  return chalk.hex("#8B5CF6")(bar);
}

export function startProgress(label: string, total: number, initialMessage = ""): ProgressHandle {
  const terminal = createTerminalRenderer();
  let current = 0;
  let message = initialMessage;

  const renderFrame = () => {
    const bar = renderProgressBar(current, total);
    const count = chalk.white(`${current}/${Math.max(total, 1)}`);
    const prefix = `${bar} ${count} ${chalk.bold(label)}`;
    terminal.render(message ? `${prefix} ${chalk.dim(message)}` : prefix);
  };

  renderFrame();

  return {
    advance(step = 1, nextMessage) {
      current = Math.min(total, current + step);
      if (nextMessage !== undefined) message = nextMessage;
      renderFrame();
    },
    fail(nextMessage: string) {
      terminal.finish(`${S.fail} ${nextMessage}`);
    },
    set(nextCurrent: number, nextMessage?: string) {
      current = Math.max(0, Math.min(total, nextCurrent));
      if (nextMessage !== undefined) message = nextMessage;
      renderFrame();
    },
    stop() {
      terminal.clear();
    },
    succeed(nextMessage: string) {
      terminal.finish(`${S.ok} ${nextMessage}`);
    },
    update(nextMessage: string) {
      message = nextMessage;
      renderFrame();
    },
  };
}

// ── JSON Output ─────────────────────────────────────────────────────────────

export function writeJsonOutput(data: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
