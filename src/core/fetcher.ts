import type { Page } from "puppeteer-core";

import type { BrowserLaunchOptions, NavigationWaitUntil } from "./browser.js";
import { gotoAndWait, responseStatus, withBrowserSession } from "./browser.js";
import { parsePageDocument } from "./parser.js";
import type { PageSnapshot } from "./types.js";

function buildPageSnapshot(input: {
  fetchedAt?: string;
  finalUrl: string;
  html: string;
  requestedUrl: string;
  status: number | null;
}): PageSnapshot {
  const parsed = parsePageDocument(input.html, input.finalUrl);

  return {
    ...parsed,
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    finalUrl: input.finalUrl,
    html: input.html,
    requestedUrl: input.requestedUrl,
    status: input.status
  };
}

export async function fetchPageSnapshot(
  page: Page,
  url: string,
  options: {
    delayMs: number;
    timeoutMs: number;
    waitUntil: NavigationWaitUntil;
  }
): Promise<PageSnapshot> {
  const response = await gotoAndWait(page, url, options);
  const html = await page.content();
  const finalUrl = page.url();

  return buildPageSnapshot({
    finalUrl,
    html,
    requestedUrl: url,
    status: responseStatus(response)
  });
}

export async function fetchPageSnapshotWithEngine(
  browser: BrowserLaunchOptions,
  url: string,
  options: {
    waitUntil: NavigationWaitUntil;
  }
): Promise<PageSnapshot> {
  return withBrowserSession(browser, async ({ page }) =>
    fetchPageSnapshot(page, url, {
      delayMs: browser.delayMs,
      timeoutMs: browser.timeoutMs,
      waitUntil: options.waitUntil
    })
  );
}

export function summarizePageSnapshot(snapshot: PageSnapshot) {
  return {
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
