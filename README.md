# webfn

```
 _       __     __    ______
| |     / /__  / /_  / ____/___
| | /| / / _ \/ __ \/ /_  / __ \
| |/ |/ /  __/ /_/ / __/ / / / /
|__/|__/\___/_.___/_/   /_/ /_/
                                
```

Agent-oriented CLI for browser-backed search, fetch, and crawl workflows.

Running `webfn` with no arguments shows the banner, root help, and examples.

- search the web and extract structured results
- fetch rendered pages and extract readable markdown
- crawl sites from sitemaps or internal links
- store artifacts on disk
- auto-detect agent mode — outputs JSON when piped, rich output in TTY

## Structure

```text
.
├── src
│   ├── cli.ts
│   ├── commands
│   │   ├── common.ts
│   │   ├── collect.ts
│   │   ├── crawl.ts
│   │   ├── doctor.ts
│   │   ├── fetch.ts
│   │   ├── index.ts
│   │   └── search.ts
│   ├── core
│   │   ├── browser.ts
│   │   ├── config.ts
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
│       ├── ui.ts
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

## Agent-First Design

When stdout is **piped** (e.g. an AI agent calling the CLI), webfn automatically outputs structured JSON. When stdout is a **TTY** (human terminal), it renders rich formatted output with progress bars and tables.

```bash
# Agent mode (auto-detected):
webfn fetch https://example.com | jq .page.title

# Force JSON in a TTY:
webfn fetch https://example.com --json

# Human-friendly output (default in terminal):
webfn fetch https://example.com
```

All JSON output follows a consistent envelope:

```json
{
  "ok": true,
  "command": "fetch",
  "page": { ... },
  "browser": { ... },
  "files": [ ... ],
  "storage": { ... }
}
```

## Commands

```bash
webfn search "ai agents"
webfn collect "ai agents"
webfn fetch https://example.com
webfn crawl https://example.com --depth 2 --max-pages 50
webfn fetch https://example.com --stdout --no-frontmatter
webfn doctor
```

Dev equivalents:

```bash
pnpm dev search "ai agents"
pnpm dev collect "ai agents" --results 3
pnpm dev fetch https://example.com
pnpm dev crawl https://example.com --mode sitemap --fetch-pages
pnpm dev fetch https://example.com --stdout --no-frontmatter
pnpm dev doctor --json
```

## Common Options

These options are shared across most commands:

| Flag | Description | Default |
|:---|:---|:---|
| `--headed` | Visible Chrome window | headless |
| `--engine <e>` | `chrome` or `lightpanda` | auto |
| `--chrome <path>` | Chrome executable path | auto-detect |
| `--timeout <ms>` | Navigation timeout | `30000` |
| `--delay <ms>` | Post-load wait time | `1200` |
| `--user-agent <ua>` | Custom user agent | built-in |
| `--lp-port <port>` | Lightpanda CDP port | `9222` |
| `--md-engine <e>` | `defuddle` or `turndown` | `defuddle` |
| `-o, --output-dir <dir>` | Output directory | config/`data` |
| `--config <path>` | Config file path | auto-detect |
| `--no-save` | Skip file output | save enabled |
| `--json` | Force JSON output | auto (TTY) |

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
pnpm dev collect "openai agents" --provider google --results 3
pnpm dev crawl https://example.com --mode links --fetch-pages --max-pages 10
pnpm dev fetch https://example.com --headed
pnpm dev fetch https://example.com --engine chrome --stdout --no-frontmatter
pnpm dev fetch https://example.com --md-engine turndown
```

## Output Layout

Artifacts are written to the configured output directory. The built-in fallback is `data/`.

```text
<output-dir>/
  search/
    ai-agents-<hash>/
      collect.json
      google.json
  example.com/
    crawl/
      home-<hash>.json
    fetch/
      home-<hash>/
        index.md
```

Use `--no-save` if you only want stdout/JSON output.

`fetch` saves Markdown with metadata at the top by default. Use `--no-frontmatter` to disable it. Use `--html` or `--meta` when you also want rendered HTML or metadata JSON:

```bash
pnpm dev fetch https://example.com --html --meta
pnpm dev fetch https://example.com --no-frontmatter
```

`fetch` supports both markdown engines:

```bash
pnpm dev fetch https://example.com --md-engine defuddle
pnpm dev fetch https://example.com --md-engine turndown
```

`crawl` can optionally save full fetched page artifacts for each crawled URL:

```bash
pnpm dev crawl https://example.com --fetch-pages
pnpm dev crawl https://example.com --fetch-pages --html --meta
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
- `collect` saves the search result set, fetches each result page, and writes a collection report.
- `crawl --fetch-pages` saves fetched page artifacts for every crawled page.
- Sitemap crawling is attempted before internal-link crawling when `--mode auto`.
- `fetch` stores Markdown with frontmatter by default and can optionally store metadata JSON and rendered HTML. Disable frontmatter with `--no-frontmatter`.
- `defuddle` is the default markdown engine; `turndown` is available as an alternative.
- Output is automatically JSON when stdout is piped (agent-friendly). Use `--json` to force JSON in a TTY.
