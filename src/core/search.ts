import { parseHTML } from "linkedom";
import type { Page } from "puppeteer-core";

import type { BrowserLaunchOptions } from "./browser.js";
import { gotoAndWait, withBrowserSession } from "./browser.js";
import type { SearchResult } from "./types.js";
import { compactText, sleep } from "../lib/text.js";
import { canonicalizeUrl } from "../lib/url.js";

export type SearchProvider = SearchResult["provider"];
const DUCKDUCKGO_HTML_ENDPOINT = "https://html.duckduckgo.com/html/";

function buildSearchUrl(query: string, provider: SearchProvider) {
  if (provider === "duckduckgo") {
    return `${DUCKDUCKGO_HTML_ENDPOINT}?q=${encodeURIComponent(query)}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en&gl=us`;
}

function normalizeGoogleResultLink(input: string) {
  const candidate = canonicalizeUrl(input);

  if (!candidate) {
    return null;
  }

  const url = new URL(candidate);

  if (url.hostname.includes("google.") && url.pathname === "/url") {
    const nested = url.searchParams.get("q");
    return nested ? canonicalizeUrl(nested) : null;
  }

  return candidate;
}

function normalizeDuckDuckGoResultLink(input: string) {
  const candidate = canonicalizeUrl(input, DUCKDUCKGO_HTML_ENDPOINT);

  if (!candidate) {
    return null;
  }

  const url = new URL(candidate);

  if (url.hostname.endsWith("duckduckgo.com") && url.pathname === "/l/") {
    const nested = url.searchParams.get("uddg");
    return nested ? canonicalizeUrl(nested) : null;
  }

  return candidate;
}

async function dismissGoogleConsent(page: Page) {
  const consentButton = await page.$(
    'button[id="L2AGLb"], form[action*="consent"] button, button[aria-label*="Accept all"]'
  );

  if (!consentButton) {
    return;
  }

  await consentButton.click();
  await sleep(800);
}

function extractGoogleResultsFromHtml(html: string, maxResults: number): SearchResult[] {
  const { document } = parseHTML(html);

  if (document.querySelector("#captcha-form")) {
    throw new Error("Google returned a captcha or interstitial. Use headed Chrome, proxies, or a different provider.");
  }

  const rawResults: Array<{ link: string; snippet: string | null; title: string }> = [];
  const seen = new Set<string>();

  for (const element of Array.from(document.querySelectorAll("div.g, .tF2Cxc, div[data-sokoban-container], .Gx5Zad"))) {
    if (rawResults.length >= maxResults) {
      break;
    }

    const title = compactText(element.querySelector("h3")?.textContent);
    const href = compactText(element.querySelector("a[href]")?.getAttribute("href"));
    const snippet = compactText(
      element.querySelector(".VwiC3b, .s3v9rd, .IsZvec, .lEBKkf, [data-sncf]")?.textContent
    );

    if (!title || !href || seen.has(href)) {
      continue;
    }

    seen.add(href);
    rawResults.push({ link: href, snippet: snippet || null, title });
  }

  if (rawResults.length === 0) {
    for (const heading of Array.from(document.querySelectorAll("h3"))) {
      if (rawResults.length >= maxResults) {
        break;
      }

      const anchor =
        heading.closest("a") ??
        heading.parentElement?.closest("a") ??
        heading.parentElement?.querySelector("a[href]");
      const href = compactText(anchor?.getAttribute("href"));
      const title = compactText(heading.textContent);

      if (!href || !title || seen.has(href)) {
        continue;
      }

      seen.add(href);
      rawResults.push({
        link: href,
        snippet:
          compactText(
            heading.closest("[data-hveid], div.g, article, section")?.querySelector(".VwiC3b, .s3v9rd, .IsZvec, span")
              ?.textContent
          ) || null,
        title
      });
    }
  }

  const deduped: SearchResult[] = [];
  const normalizedSeen = new Set<string>();

  for (const result of rawResults) {
    const link = normalizeGoogleResultLink(result.link);

    if (!link || normalizedSeen.has(link) || link.includes("google.com/search") || link.includes("accounts.google")) {
      continue;
    }

    normalizedSeen.add(link);
    deduped.push({
      link,
      provider: "google",
      snippet: result.snippet,
      title: result.title
    });
  }

  return deduped.slice(0, maxResults);
}

function extractDuckDuckGoResultsFromHtml(html: string, maxResults: number): SearchResult[] {
  const { document } = parseHTML(html);
  const challengeTitle = document.querySelector(".anomaly-modal__title")?.textContent ?? "";

  if (challengeTitle.includes("Unfortunately, bots use DuckDuckGo too.")) {
    throw new Error(
      "DuckDuckGo HTML returned an anti-bot challenge. Use Google, headed Chrome, or add proxy/session handling."
    );
  }

  const rawResults: Array<{ link: string; snippet: string | null; title: string }> = [];
  const seen = new Set<string>();

  for (const element of Array.from(document.querySelectorAll(".result, .results_links, .web-result"))) {
    if (rawResults.length >= maxResults) {
      break;
    }

    if (element.classList.contains("result--ad")) {
      continue;
    }

    const linkElement = element.querySelector("a.result__a, .result__title a, h2 a");
    const href = compactText(linkElement?.getAttribute("href"));
    const title = compactText(linkElement?.textContent);
    const snippet = compactText(element.querySelector(".result__snippet, .result-snippet")?.textContent);

    if (!href || !title || seen.has(href)) {
      continue;
    }

    seen.add(href);
    rawResults.push({ link: href, snippet: snippet || null, title });
  }

  const deduped: SearchResult[] = [];
  const normalizedSeen = new Set<string>();

  for (const result of rawResults) {
    const link = normalizeDuckDuckGoResultLink(result.link);

    if (!link || normalizedSeen.has(link)) {
      continue;
    }

    normalizedSeen.add(link);
    deduped.push({
      link,
      provider: "duckduckgo",
      snippet: result.snippet,
      title: result.title
    });
  }

  return deduped.slice(0, maxResults);
}

function extractResultsFromHtml(provider: SearchProvider, html: string, maxResults: number) {
  return provider === "google"
    ? extractGoogleResultsFromHtml(html, maxResults)
    : extractDuckDuckGoResultsFromHtml(html, maxResults);
}

function isSearchChallengeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /captcha|anti-bot|interstitial/i.test(error.message);
}

export async function searchWeb(
  browser: BrowserLaunchOptions,
  query: string,
  options: {
    delayMs: number;
    maxResults: number;
    provider: SearchProvider;
    timeoutMs: number;
  }
){
  const url = buildSearchUrl(query, options.provider);

  try {
    return await withBrowserSession(browser, async ({ page }) => {
      await gotoAndWait(page, url, {
        delayMs: options.delayMs,
        timeoutMs: options.timeoutMs,
        waitUntil: "domcontentloaded"
      });

      if (options.provider === "google") {
        await dismissGoogleConsent(page);
      }

      const html = await page.content();
      return extractResultsFromHtml(options.provider, html, options.maxResults);
    });
  } catch (error: unknown) {
    if (browser.engine === undefined && browser.headless && isSearchChallengeError(error)) {
      return searchWeb({ ...browser, engine: "chrome" }, query, options);
    }

    throw error;
  }
}
