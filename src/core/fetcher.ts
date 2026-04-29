import type { Page } from "puppeteer-core";

import type { BrowserLaunchOptions, BrowserRunInfo, NavigationWaitUntil } from "./browser.js";
import { gotoAndWait, responseStatus, withBrowserSession } from "./browser.js";
import { parsePageDocument } from "./parser.js";
import type { PageSnapshot } from "./types.js";
import { resolvePreferredUrl } from "../lib/url.js";

export function buildPageSnapshot(input: {
  browser: BrowserRunInfo;
  fetchedAt?: string;
  finalUrl: string;
  html: string;
  requestedUrl: string;
  status: number | null;
}): PageSnapshot {
  const resolvedFinalUrl = resolvePreferredUrl(input.finalUrl, input.requestedUrl);
  const parsed = parsePageDocument(input.html, resolvedFinalUrl);

  return {
    ...parsed,
    browser: input.browser,
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    finalUrl: resolvedFinalUrl,
    html: input.html,
    requestedUrl: input.requestedUrl,
    status: input.status
  };
}

export async function fetchPageSnapshot(
  page: Page,
  url: string,
  options: {
    browser: BrowserRunInfo;
    delayMs: number;
    timeoutMs: number;
    waitUntil: NavigationWaitUntil;
  }
): Promise<PageSnapshot> {
  const response = await gotoAndWait(page, url, options);
  const html = await page.content();
  const finalUrl = page.url();

  return buildPageSnapshot({
    browser: options.browser,
    finalUrl,
    html,
    requestedUrl: url,
    status: responseStatus(response)
  });
}

import { fetchCloudflareContent } from "./cloudflare.js";

export async function fetchPageSnapshotWithEngine(
  browser: BrowserLaunchOptions,
  url: string,
  options: {
    waitUntil: NavigationWaitUntil;
  }
): Promise<PageSnapshot> {
  if (browser.engine === "cloudflare") {
    const html = await fetchCloudflareContent(url, browser);
    return buildPageSnapshot({
      browser: {
        engine: "cloudflare",
        headless: true,
        mode: "headless",
        requestedEngine: "cloudflare",
      },
      finalUrl: url,
      html,
      requestedUrl: url,
      status: 200,
    });
  }

  return withBrowserSession(browser, async ({ page, runtime }) =>
    fetchPageSnapshot(page, url, {
      browser: runtime,
      delayMs: browser.delayMs,
      timeoutMs: browser.timeoutMs,
      waitUntil: options.waitUntil
    })
  );
}

export function summarizePageSnapshot(snapshot: PageSnapshot) {
  return {
    browser: snapshot.browser,
    description: snapshot.description,
    fetchedAt: snapshot.fetchedAt,
    finalUrl: snapshot.finalUrl,
    headings: snapshot.headings.length,
    htmlLength: snapshot.html.length,
    links: snapshot.links.length,
    media: snapshot.media.length,
    requestedUrl: snapshot.requestedUrl,
    status: snapshot.status,
    title: snapshot.title
  };
}
