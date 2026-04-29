---
name: webfn
description: Use the webfn CLI to search the web, fetch web pages as clean markdown, take screenshots, and crawl websites. Use this skill whenever the user asks you to look something up on the internet, read a web page, get the content of a URL, scrape a website, take a screenshot of a site, research a topic online, or gather information from the web. Also use it when you need to fetch documentation, check a live website, or extract structured data from web pages. Even if the user doesn't say "webfn", use this skill for any web browsing, web scraping, URL fetching, or internet research task.
---

# Webfn — Web Data Extraction CLI

Webfn is a CLI tool installed on this machine that lets you search the web, fetch pages as markdown, take screenshots, and crawl websites. It is designed to be called by AI agents and outputs structured JSON when piped.

## Quick Check

Before using webfn, verify it's available:

```bash
npx webfn-cli doctor
```

If it's not installed, install it:

```bash
npm install -g webfn-cli
```

After installation, the `webfn` command is available globally. You can also use `npx webfn-cli` without installing.

## Core Commands

### 1. Fetch a Web Page

Fetches a URL and converts it to clean, readable markdown. This is the most common command.

```bash
# Fetch and save markdown to disk
webfn fetch https://example.com

# Print markdown directly to stdout (best for piping to yourself)
webfn fetch https://example.com --stdout --no-frontmatter

# Force JSON output (useful when you need structured data)
webfn fetch https://example.com --json --no-save

# Also save the raw HTML and metadata
webfn fetch https://example.com --html --meta
```

**When piped** (which is how you'll usually call it), webfn automatically outputs JSON:

```json
{
  "ok": true,
  "command": "fetch",
  "page": {
    "url": "https://example.com",
    "title": "Example Domain",
    "markdown": "# Example Domain\n\nThis domain is for use in..."
  }
}
```

### 2. Search the Web

Searches Google or DuckDuckGo and returns structured results.

```bash
# Search Google (default)
webfn search "latest openai models" --json --no-save

# Search DuckDuckGo (less likely to be blocked)
webfn search "latest openai models" --provider duckduckgo --json --no-save

# Limit number of results
webfn search "rust async tutorial" -n 5 --json --no-save
```

**JSON output:**

```json
{
  "ok": true,
  "command": "search",
  "results": [
    { "title": "...", "url": "https://...", "snippet": "..." }
  ]
}
```

### 3. Collect (Search + Fetch)

Searches the web and then fetches the full content of each result. This is the power move for deep research.

```bash
# Search and fetch the top 3 results
webfn collect "how to deploy nextjs to cloudflare" --results 3 --json --no-save

# Use DuckDuckGo to avoid bot detection
webfn collect "react server components" --provider duckduckgo --results 5
```

### 4. Screenshot

Takes a PNG screenshot of a website.

```bash
# Viewport screenshot
webfn screenshot https://example.com

# Full-page screenshot (scrolls the entire page)
webfn screenshot https://example.com --full

# Wait longer for animations to finish before capturing
webfn screenshot https://example.com --delay 5000
```

### 5. Crawl

Discovers all pages on a website via sitemap or internal links.

```bash
# Auto-detect crawl strategy (tries sitemap first, then links)
webfn crawl https://example.com

# Crawl via internal links with depth control
webfn crawl https://example.com --mode links --depth 3 --max-pages 50

# Crawl and also fetch the full content of each discovered page
webfn crawl https://example.com --fetch-pages --json --no-save
```

### 6. Doctor

Checks the environment and reports what's available.

```bash
webfn doctor --json
```

## Important Flags

| Flag | What it does |
|---|---|
| `--json` | Force JSON output (auto-detected when piped) |
| `--no-save` | Don't write files to disk, just output |
| `--stdout` | Print extracted markdown to stdout (fetch only) |
| `--no-frontmatter` | Omit YAML frontmatter from markdown |
| `--engine <e>` | `chrome`, `lightpanda`, or `cloudflare` |
| `--delay <ms>` | Wait time after page load (default: 1200ms) |
| `--timeout <ms>` | Navigation timeout (default: 30000ms) |
| `--provider <p>` | `google` or `duckduckgo` (search/collect) |
| `--md-engine <e>` | `defuddle` (default, article-focused) or `turndown` (literal) |

## Best Practices for Agent Usage

1. **Always use `--json --no-save`** when you just need data and don't want to write files to disk.

2. **Use `--stdout --no-frontmatter`** with `fetch` when you want raw markdown text piped directly.

3. **Prefer DuckDuckGo** (`--provider duckduckgo`) for search — Google is more likely to return CAPTCHAs.

4. **Use `collect`** instead of search + fetch separately when you need to research a topic. It handles the full pipeline.

5. **Use `--engine cloudflare`** if Cloudflare credentials are configured — this runs the browser on Cloudflare's edge and is harder for websites to block. Requires `CLOUDFLARE_ACC_ID` and `CLOUDFLARE_TOKEN` environment variables.

6. **Handle errors gracefully** — webfn returns `{ "ok": false, "error": "..." }` on failure.

7. **For full command reference**, read the `references/commands.md` file in this skill directory.

## Typical Agent Workflow

When the user asks you to look something up or get info from the web:

```bash
# Step 1: Search for the topic
webfn search "user's query here" --provider duckduckgo --json --no-save -n 5

# Step 2: Fetch the most relevant result
webfn fetch https://relevant-url.com --stdout --no-frontmatter

# Or do both at once with collect:
webfn collect "user's query here" --provider duckduckgo --results 3 --json --no-save
```

Parse the JSON output, extract the information, and present it to the user.
