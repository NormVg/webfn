# Webfn Documentation

Welcome to the comprehensive documentation for **Webfn**, the agent-oriented CLI for browser-backed search, fetch, and crawl workflows.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Commands](#commands)
  - [Search](#search)
  - [Collect](#collect)
  - [Fetch](#fetch)
  - [Screenshot](#screenshot)
  - [Crawl](#crawl)
  - [Doctor](#doctor)
- [Browser Engines](#browser-engines)
- [Markdown Engines](#markdown-engines)
- [Agent Integration](#agent-integration)

---

## Overview

Webfn is designed from the ground up to be the ultimate companion for AI agents and automation scripts that need to interface with the modern web. It abstracts away the complexities of headless browsers, search engine scraping, and HTML-to-Markdown conversion.

## Configuration

Webfn uses a tiered configuration resolution system. Options are applied in the following order of precedence:

1. **CLI Flags**: `--output-dir <dir>`
2. **Environment Variables**: `WEBFN_OUTPUT_DIR`
3. **Config File**: `webfn.config.json`
4. **Built-in Defaults**

### The `webfn.config.json` File

You can create a `webfn.config.json` file in your project root to set default behaviors.

```json
{
  "outputDir": "agent-data",
  "provider": "google | duckduckgo",
  "mdEngine": "defuddle | turndown",
  "timeout": 30000,
  "delay": 1200,
  "results": 5,
  "waitUntil": "networkidle2 | domcontentloaded",
  "engine": "chrome | lightpanda | cloudflare",
  "cloudflareAccountId": "your_cloudflare_account_id_here",
  "cloudflareApiToken": "your_cloudflare_api_token_here"
}
```

#### Field Descriptions

- **`outputDir`**: Directory where fetched files, screenshots, and metadata will be saved.
- **`provider`**: Search engine to use for queries.
- **`mdEngine`**: Markdown parser for converting HTML to Markdown.
- **`timeout`**: Maximum time in milliseconds to wait for page navigation and fetching.
- **`delay`**: Time in milliseconds to wait AFTER the page has loaded before capturing content/screenshot.
- **`results`**: Default number of search results to fetch and collect.
- **`waitUntil`**: Puppeteer wait condition for page loads.
- **`engine`**: Browser execution engine. 'chrome' (local headless), 'lightpanda' (local fast engine), 'cloudflare' (remote serverless edge rendering).
- **`cloudflareAccountId`**: Your Cloudflare Account ID. Required ONLY if engine is set to 'cloudflare'. (It is safer to set this in your `.env` file).
- **`cloudflareApiToken`**: Your Cloudflare API Token. Required ONLY if engine is set to 'cloudflare'. (It is safer to set this in your `.env` file).

---

## Commands

### Search

Searches the web using a specific provider and returns structured data.

```bash
webfn search "openai latest models" --provider duckduckgo
```

### Collect

Searches the web and then immediately fetches the HTML/Markdown content for the top X results.

```bash
webfn collect "how to learn rust" --results 3
```

### Fetch

Fetches a specific URL and extracts readable Markdown.

```bash
webfn fetch https://example.com --html --meta
```

### Screenshot

Takes a screenshot of a website. Supports full-page scrolling and Cloudflare edge rendering.

```bash
webfn screenshot https://example.com --full --delay 2000
```

### Crawl

Crawls an entire website starting from a given URL or Sitemap.

```bash
webfn crawl https://example.com --depth 2 --max-pages 50 --fetch-pages
```

### Doctor

Checks your local environment to ensure Chrome and other dependencies are correctly installed.

```bash
webfn doctor
```

---

## Browser Engines

Webfn supports multiple execution backends to optimize for speed, stealth, or cost.

1. **Lightpanda (`--engine lightpanda`)**: Ultra-fast, lightweight headless browser optimized for data extraction. Uses lower memory.
2. **Chrome (`--engine chrome`)**: Uses your local Chrome/Chromium installation. Best for complex SPAs and full-page rendering.
3. **Cloudflare (`--engine cloudflare`)**: Uses Cloudflare's Browser Rendering REST API. Runs entirely on Cloudflare's edge network. Bypasses many basic bot protections. Does not support `--full` screenshots.

---

## Markdown Engines

Converting complex DOM structures to readable Markdown is challenging. Webfn provides two parsers:

1. **Defuddle (`--md-engine defuddle`)**: A custom-built, highly accurate extractor designed to strip noise (navbars, footers) and focus purely on the article content. This is the **default**.
2. **Turndown (`--md-engine turndown`)**: A standard HTML-to-Markdown library. Best for converting the entire page literally.

---

## Agent Integration

Webfn is uniquely built for AI agents.

### Auto-JSON Mode

If Webfn detects that its output is being piped to another program (or read by a child process), it automatically silences all progress bars, spinners, and interactive UI, and outputs a single, strictly formatted JSON object.

```bash
# Handled by a terminal user (rich UI)
webfn fetch https://example.com

# Handled by an AI Agent or script (JSON output)
webfn fetch https://example.com | jq .page.markdown
```

You can force JSON output in a terminal using the `--json` flag.
