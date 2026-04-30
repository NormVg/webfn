import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

import { lightpanda } from "@lightpanda/browser";
import puppeteer from "puppeteer-core";
import type { Browser, BrowserContext, HTTPResponse, Page } from "puppeteer-core";

import { sleep } from "../lib/text.js";

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type BrowserEngineOption = "chrome" | "lightpanda" | "cloudflare";
export type ResolvedBrowserEngine = BrowserEngineOption;
export type NavigationWaitUntil = "domcontentloaded" | "networkidle2";
export type BrowserRunMode = "headed" | "headless";

export type BrowserLaunchOptions = {
  delayMs: number;
  engine?: BrowserEngineOption;
  executablePath?: string;
  headless: boolean;
  lightpandaPort: number;
  timeoutMs: number;
  userAgent?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
};

export type BrowserSession = {
  browser: Browser;
  close: () => Promise<void>;
  engine: ResolvedBrowserEngine;
  executablePath?: string;
  page: Page;
  runtime: BrowserRunInfo;
};

export type BrowserRunInfo = {
  engine: ResolvedBrowserEngine;
  headless: boolean;
  mode: BrowserRunMode;
  requestedEngine: BrowserEngineOption | "default";
  executablePath?: string;
  fallbackFrom?: BrowserEngineOption;
};

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/opt/google/chrome/chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
].filter((value): value is string => Boolean(value));

export function findChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getLightpandaExecutablePath() {
  if (process.env.LIGHTPANDA_EXECUTABLE_PATH) {
    return process.env.LIGHTPANDA_EXECUTABLE_PATH;
  }

  // Prefer the official installer path over the npm-bundled binary
  const officialPath = `${homedir()}/.local/bin/lightpanda`;
  if (existsSync(officialPath)) {
    return officialPath;
  }

  return `${homedir()}/.cache/lightpanda-node/lightpanda`;
}

export async function detectLightpandaAvailability() {
  return existsSync(getLightpandaExecutablePath());
}

export async function resolveBrowserEngine(options: BrowserLaunchOptions): Promise<ResolvedBrowserEngine> {
  if (!options.headless) {
    if (options.engine === "lightpanda") {
      throw new Error("Lightpanda is headless-only. Use Chrome/Chromium for headed mode.");
    }
    if (options.engine === "cloudflare") {
      throw new Error("Cloudflare Browser Rendering is headless-only.");
    }

    return "chrome";
  }

  if (options.engine === "chrome" || options.engine === "cloudflare") {
    return options.engine;
  }

  if (!(await detectLightpandaAvailability())) {
    throw new Error(
      "Headless mode defaults to Lightpanda, but @lightpanda/browser is not available. Install it or pass --engine chrome."
    );
  }

  return "lightpanda";
}

function createBrowserRunInfo(
  options: BrowserLaunchOptions,
  engine: ResolvedBrowserEngine,
  executablePath?: string
): BrowserRunInfo {
  const info: BrowserRunInfo = {
    engine,
    headless: options.headless,
    mode: options.headless ? "headless" : "headed",
    requestedEngine: options.engine ?? "default"
  };

  if (executablePath) {
    info.executablePath = executablePath;
  }

  return info;
}

export function formatBrowserRunInfo(runtime: Pick<BrowserRunInfo, "engine" | "fallbackFrom" | "mode">) {
  const fallbackFrom = runtime.fallbackFrom;
  return fallbackFrom ? `${runtime.engine} (${runtime.mode}, fallback from ${fallbackFrom})` : `${runtime.engine} (${runtime.mode})`;
}

async function configurePage(page: Page, options: BrowserLaunchOptions) {
  await page.setViewport({ height: 960, width: 1440 });
  await page.setUserAgent(options.userAgent ?? DEFAULT_USER_AGENT);
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9"
  });
  page.setDefaultNavigationTimeout(options.timeoutMs);
  page.setDefaultTimeout(options.timeoutMs);

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      configurable: true,
      get: () => undefined
    });
  });
}

async function closePageContext(page: Page | null, context: BrowserContext | null) {
  await page?.close().catch(() => undefined);
  await context?.close().catch(() => undefined);
}

function stopLightpandaProcess(proc: ChildProcessWithoutNullStreams) {
  proc.stdout.destroy();
  proc.stderr.destroy();
  proc.kill("SIGKILL");
}

/**
 * Kill any stale lightpanda processes occupying the target port.
 * Prevents zombie processes from blocking new sessions.
 */
function killStaleProcessesOnPort(port: number) {
  try {
    // Only target the process LISTENING on the port, otherwise lsof matches the Node client connection and kills itself!
    const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: "utf-8" }).trim();
    if (output) {
      for (const pid of output.split("\n")) {
        try { process.kill(Number(pid), "SIGKILL"); } catch { /* already dead */ }
      }
    }
  } catch {
    // No process on this port — good
  }
}

async function createChromeSession(options: BrowserLaunchOptions): Promise<BrowserSession> {
  const executablePath = options.executablePath ?? findChromeExecutable();

  if (!executablePath) {
    throw new Error("Could not find Chrome/Chromium. Install it or provide --chrome /path/to/browser.");
  }

  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1440,960"
    ],
    defaultViewport: { height: 960, width: 1440 },
    executablePath,
    headless: options.headless,
    timeout: options.timeoutMs
  });

  const page = await browser.newPage();
  await configurePage(page, options);

  return {
    browser,
    close: async () => {
      await browser.close().catch(() => undefined);
    },
    engine: "chrome",
    executablePath,
    page,
    runtime: createBrowserRunInfo(options, "chrome", executablePath)
  };
}

async function createLightpandaSession(options: BrowserLaunchOptions): Promise<BrowserSession> {
  const host = "127.0.0.1";
  const port = options.lightpandaPort;
  const executablePath = getLightpandaExecutablePath();

  if (!existsSync(executablePath)) {
    throw new Error("Lightpanda is not installed.");
  }

  // Kill any zombie lightpanda from previous runs
  killStaleProcessesOnPort(port);

  const proc = spawn(executablePath, ["serve", "--host", host, "--port", port.toString()]);
  let procExited = false;
  let procError = "";
  
  proc.stderr?.on("data", (data: Buffer) => { procError += data.toString(); });
  proc.on("exit", () => { procExited = true; });

  // Ensure cleanup on unexpected exit (Ctrl+C, crash, etc.)
  const cleanup = () => { stopLightpandaProcess(proc); };
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  const MAX_ATTEMPTS = 15;
  const RETRY_MS = 200;

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (procExited) {
        throw new Error(`Lightpanda process exited before accepting connections.${procError ? " stderr: " + procError.trim() : ""}`);
      }

      try {
        browser = await puppeteer.connect({
          browserWSEndpoint: `ws://${host}:${port}`,
          defaultViewport: { height: 960, width: 1440 }
        });
        break;
      } catch {
        if (attempt === MAX_ATTEMPTS - 1) {
          throw new Error(`Lightpanda is not responding on port ${port}. It may be incompatible with your Node version.${procError ? " stderr: " + procError.trim() : ""}`);
        }
        await sleep(RETRY_MS);
      }
    }

    context = await browser!.createBrowserContext();
    page = await context.newPage();
    await configurePage(page, options);

    const removeCleanupListeners = () => {
      process.removeListener("exit", cleanup);
      process.removeListener("SIGINT", cleanup);
      process.removeListener("SIGTERM", cleanup);
    };

    return {
      browser: browser!,
      close: async () => {
        removeCleanupListeners();
        await closePageContext(page, context);
        browser?.disconnect();
        stopLightpandaProcess(proc);
      },
      engine: "lightpanda",
      executablePath,
      page,
      runtime: createBrowserRunInfo(options, "lightpanda", executablePath)
    };
  } catch (error: unknown) {
    process.removeListener("exit", cleanup);
    process.removeListener("SIGINT", cleanup);
    process.removeListener("SIGTERM", cleanup);
    await closePageContext(page, context);
    browser?.disconnect();
    stopLightpandaProcess(proc);
    throw error;
  }
}

async function createBrowserSession(options: BrowserLaunchOptions): Promise<BrowserSession> {
  const engine = await resolveBrowserEngine(options);

  if (engine === "lightpanda") {
    try {
      return await createLightpandaSession(options);
    } catch (e) {
      console.error("[DEBUG] Lightpanda session failed:", e);
      // Lightpanda failed (likely Node version mismatch) — fall back to Chrome
      return createChromeSession(options);
    }
  }

  return createChromeSession(options);
}

export async function withBrowserSession<T>(
  options: BrowserLaunchOptions,
  task: (session: BrowserSession) => Promise<T>
) {
  const session = await createBrowserSession(options);

  try {
    return await task(session);
  } finally {
    await session.close();
  }
}

export async function gotoAndWait(
  page: Page,
  url: string,
  options: {
    delayMs: number;
    timeoutMs: number;
    waitUntil: NavigationWaitUntil;
  }
) {
  const response = await page.goto(url, {
    timeout: options.timeoutMs,
    waitUntil: options.waitUntil
  });

  if (options.delayMs > 0) {
    await sleep(options.delayMs);
  }

  return response;
}

export function responseStatus(response: HTTPResponse | null) {
  return response?.status() ?? null;
}
