# webfn

`webfn` is a `pnpm`-managed CLI for agent-style internet access workflows:

- search the web
- fetch rendered pages
- crawl sites from sitemaps or internal links
- scrape readable markdown
- store artifacts on disk

## Structure

```text
.
├── src
│   ├── cli.ts
│   ├── commands
│   │   ├── common.ts
│   │   ├── crawl.ts
│   │   ├── doctor.ts
│   │   ├── fetch.ts
│   │   ├── index.ts
│   │   ├── scrape.ts
│   │   └── search.ts
│   ├── core
│   │   ├── browser.ts
│   │   ├── crawler.ts
│   │   ├── fetcher.ts
│   │   ├── http.ts
│   │   ├── parser.ts
│   │   ├── search.ts
│   │   ├── storage.ts
│   │   └── types.ts
│   └── lib
│       ├── logger.ts
│       ├── text.ts
│       └── url.ts
├── .gitignore
├── .npmrc
├── package.json
├── README.md
└── tsconfig.json
```

## Architecture

- `src/commands/` contains the CLI surface only.
- `src/core/` contains browser, crawl, parse, and storage logic.
- `src/lib/` contains small reusable helpers.
- `data/` is the default output directory when commands save artifacts.

## Commands

```bash
webfn search "ai agents"
webfn fetch https://example.com
webfn crawl https://example.com --depth 2 --max-pages 50
webfn scrape https://example.com --stdout
webfn doctor
```

Useful dev equivalents:

```bash
pnpm dev search "ai agents"
pnpm dev fetch https://example.com
pnpm dev crawl https://example.com --mode sitemap
pnpm dev scrape https://example.com --json
pnpm dev doctor --json
```

## Browser Modes

- Headless is the default.
- `--headed` runs a visible Chrome/Chromium window.
- Default headless engine: Lightpanda.
- Default headed engine: Chrome/Chromium.
- `--engine chrome` forces Chrome/Chromium.
- `--engine lightpanda` forces Lightpanda for headless runs.
- Search starts with Lightpanda in headless mode and retries with Chrome if a challenge page is detected, unless you explicitly set `--engine`.
- `puppeteer-core` is pinned to `23.6.0` because newer Puppeteer 24 builds enable CDP domains that Lightpanda does not currently implement.

Examples:

```bash
pnpm dev search "openai agents" --provider google
pnpm dev search "openai agents" --provider duckduckgo
pnpm dev fetch https://example.com --headed
pnpm dev scrape https://example.com --engine chrome --stdout
```

## Output Layout

Artifacts are written to `data/` by default.

```text
data/
  search/
    ai-agents-<hash>/
      google.json
  example.com/
    fetch-home-<hash>.json
    fetch-home-<hash>.html
    fetch-home-<hash>.md
    crawl-home-<hash>.json
    scrape-home-<hash>.json
    scrape-home-<hash>.md
```

Use `--no-store` if you only want stdout output.

## Getting Started

```bash
pnpm install
pnpm build
pnpm dev doctor
```

If Chrome is not auto-detected, either install it or pass:

```bash
pnpm dev fetch https://example.com --chrome /path/to/chrome
```

## Notes

- Google scraping is fragile and may hit consent screens, captchas, or layout changes.
- DuckDuckGo uses the HTML endpoint at `https://html.duckduckgo.com/html/`.
- DuckDuckGo can still return anti-bot challenges.
- Sitemap crawling is attempted before internal-link crawling when `--mode auto`.
- `fetch` stores metadata JSON, rendered HTML, and Markdown.
