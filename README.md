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
- Output directory is configurable with CLI flags, env, or `webfn.config.json`.

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

Artifacts are written to the configured output directory. The built-in fallback is `data/`.

```text
<output-dir>/
  search/
    ai-agents-<hash>/
      google.json
  example.com/
    fetch-home-<hash>/
      index.md
    crawl-home-<hash>.json
    scrape-home-<hash>.json
    scrape-home-<hash>.md
```

Use `--no-store` if you only want stdout output.

`fetch` saves only Markdown by default. The Markdown file includes metadata at the top. Use `--save-html` or `--save-json` when you also want rendered HTML or metadata JSON:

```bash
pnpm dev fetch https://example.com --save-html --save-json
```

## Configuration

Output directory precedence:

1. `--output-dir <dir>`
2. `WEBFN_OUTPUT_DIR`
3. `webfn.config.json`
4. built-in fallback: `data`

Example `webfn.config.json`:

```json
{
  "outputDir": "agent-data"
}
```

Use a custom config path when needed:

```bash
pnpm dev fetch https://example.com --config ./webfn.config.json
```

Saved JSON includes a `browser` block showing the actual engine and mode used:

```json
{
  "browser": {
    "engine": "lightpanda",
    "headless": true,
    "mode": "headless",
    "requestedEngine": "default"
  }
}
```

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
- `fetch` stores Markdown by default and can optionally store metadata JSON and rendered HTML.
