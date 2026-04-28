export type HeadingInfo = {
  level: number;
  text: string;
};

export type LinkInfo = {
  href: string;
  internal: boolean;
  text: string;
};

export type MediaInfo = {
  alt: string | null;
  src: string;
  type: "audio" | "image" | "source" | "video";
};

export type PageSummary = {
  canonicalUrl: string | null;
  description: string | null;
  headings: HeadingInfo[];
  links: LinkInfo[];
  media: MediaInfo[];
  metaTags: Record<string, string>;
  paragraphs: string[];
  text: string;
  title: string | null;
};

export type PageSnapshot = PageSummary & {
  fetchedAt: string;
  finalUrl: string;
  html: string;
  requestedUrl: string;
  status: number | null;
};

export type ScrapeResult = {
  author: string | null;
  description: string | null;
  finalUrl: string;
  headings: HeadingInfo[];
  links: LinkInfo[];
  markdown: string;
  media: MediaInfo[];
  published: string | null;
  requestedUrl: string;
  site: string | null;
  title: string | null;
  wordCount: number | null;
};

export type SearchResult = {
  link: string;
  provider: "duckduckgo" | "google";
  snippet: string | null;
  title: string;
};

export type CrawlPage = {
  depth: number;
  description: string | null;
  discoveredFrom: string | null;
  error: string | null;
  finalUrl: string;
  requestedUrl: string;
  source: "links" | "sitemap";
  status: number | null;
  title: string | null;
};

export type CrawlResult = {
  finishedAt: string;
  maxDepth: number;
  maxPages: number;
  pages: CrawlPage[];
  rootUrl: string;
  sitemapUrls: string[];
  startedAt: string;
  strategy: "links" | "sitemap";
};
