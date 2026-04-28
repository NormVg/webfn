import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import { compactText } from "../lib/text.js";
import { canonicalizeUrl, isInternalUrl } from "../lib/url.js";
import type { HeadingInfo, LinkInfo, MarkdownEngine, MediaInfo, PageSnapshot, PageSummary, ScrapeResult } from "./types.js";

function toArray<T>(value: Iterable<T>) {
  return Array.from(value);
}

function emptyToNull(value: string | null | undefined) {
  const compacted = compactText(value);
  return compacted || null;
}

function collectMetaTags(document: Document) {
  const entries: Array<[string, string]> = [];

  for (const element of toArray(document.querySelectorAll("meta"))) {
    const key = compactText(
      element.getAttribute("name") ??
        element.getAttribute("property") ??
        element.getAttribute("http-equiv")
    );
    const content = compactText(element.getAttribute("content"));

    if (key && content) {
      entries.push([key, content]);
    }
  }

  return Object.fromEntries(entries);
}

function collectHeadings(document: Document): HeadingInfo[] {
  return toArray(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
    .map((element) => {
      const level = Number.parseInt(element.tagName.slice(1), 10);
      const text = compactText(element.textContent);

      if (!text || Number.isNaN(level)) {
        return null;
      }

      return { level, text };
    })
    .filter((value): value is HeadingInfo => value !== null);
}

function collectParagraphs(document: Document) {
  return toArray(document.querySelectorAll("p"))
    .map((element) => compactText(element.textContent))
    .filter(Boolean);
}

function collectLinks(document: Document, pageUrl: string): LinkInfo[] {
  const seen = new Set<string>();
  const links: LinkInfo[] = [];

  for (const element of toArray(document.querySelectorAll("a[href]"))) {
    const href = canonicalizeUrl(element.getAttribute("href") ?? "", pageUrl);

    if (!href || seen.has(href)) {
      continue;
    }

    seen.add(href);
    links.push({
      href,
      internal: isInternalUrl(href, pageUrl),
      text: compactText(element.textContent)
    });
  }

  return links;
}

function collectMedia(document: Document, pageUrl: string): MediaInfo[] {
  const seen = new Set<string>();
  const media: MediaInfo[] = [];

  for (const element of toArray(document.querySelectorAll("img[src], video[src], audio[src], source[src]"))) {
    const src = canonicalizeUrl(element.getAttribute("src") ?? "", pageUrl);

    if (!src || seen.has(src)) {
      continue;
    }

    seen.add(src);
    media.push({
      alt: compactText(element.getAttribute("alt")) || null,
      src,
      type: element.tagName.toLowerCase() as MediaInfo["type"]
    });
  }

  return media;
}

export function parsePageDocument(html: string, pageUrl: string): PageSummary {
  const { document } = parseHTML(html);
  const metaTags = collectMetaTags(document);
  const canonicalUrl = canonicalizeUrl(
    document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
    pageUrl
  );

  return {
    canonicalUrl,
    description: metaTags.description ?? metaTags["og:description"] ?? null,
    headings: collectHeadings(document),
    links: collectLinks(document, pageUrl),
    media: collectMedia(document, pageUrl),
    metaTags,
    paragraphs: collectParagraphs(document),
    text: compactText(document.body?.textContent),
    title: compactText(document.title) || null
  };
}

function buildTurndownMarkdown(snapshot: PageSnapshot) {
  const { document } = parseHTML(snapshot.html);
  const turndown = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    headingStyle: "atx"
  });

  turndown.keep(["table", "thead", "tbody", "tr", "th", "td"]);

  document.querySelectorAll("script, style, noscript").forEach((element) => {
    element.remove();
  });

  const root = document.body ?? document.documentElement;
  return compactText(root?.textContent) ? turndown.turndown(root.innerHTML) : snapshot.text;
}

export async function buildScrapeResult(
  snapshot: PageSnapshot,
  options: {
    markdownEngine?: MarkdownEngine;
  } = {}
): Promise<ScrapeResult> {
  const markdownEngine = options.markdownEngine ?? "defuddle";

  if (markdownEngine === "turndown") {
    return {
      author: null,
      browser: snapshot.browser,
      description: snapshot.description,
      finalUrl: snapshot.finalUrl,
      headings: snapshot.headings,
      links: snapshot.links,
      markdown: buildTurndownMarkdown(snapshot),
      markdownEngine,
      media: snapshot.media,
      published: null,
      requestedUrl: snapshot.requestedUrl,
      site: snapshot.metaTags["og:site_name"] ?? null,
      title: snapshot.title,
      wordCount: snapshot.text.split(/\s+/).filter(Boolean).length || null
    };
  }

  const result = await Defuddle(snapshot.html, snapshot.finalUrl, {
    markdown: true,
    useAsync: false
  });

  return {
    author: emptyToNull(result.author),
    browser: snapshot.browser,
    description: emptyToNull(result.description) ?? snapshot.description,
    finalUrl: snapshot.finalUrl,
    headings: snapshot.headings,
    links: snapshot.links,
    markdown: compactText(result.content) ? result.content : snapshot.text,
    markdownEngine,
    media: snapshot.media,
    published: emptyToNull(result.published),
    requestedUrl: snapshot.requestedUrl,
    site: emptyToNull(result.site),
    title: emptyToNull(result.title) ?? snapshot.title,
    wordCount: result.wordCount ?? null
  };
}
