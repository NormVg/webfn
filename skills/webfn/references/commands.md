# Webfn Command Reference

This file contains the raw help output for all `webfn` commands. Use this as a reference if you need to look up specific flags or options.

## Global Options

```
Usage: webfn [options] [command]

Agent-oriented CLI for search, fetch, and crawl workflows

Options:
  -V, --version               output the version number
  -h, --help                  display help for command

Commands:
  search [options] <query>    Search the web with a browser-backed provider
  collect [options] <query>   Search, fetch each result, and save collected artifacts
  fetch [options] <url>       Load a page and extract readable markdown with optional metadata
  crawl [options] <url>       Discover pages via sitemap or internal links
  screenshot [options] <url>  Take a screenshot of a website
  config [options] [command]  Manage webfn configuration file
  doctor [options]            Check runtime environment and browser availability
  help [command]              display help for command
```

## `fetch`

```
Usage: webfn fetch [options] <url>

Load a page and extract readable markdown with optional metadata

Arguments:
  url                     Page URL

Options:
  --no-frontmatter        Omit YAML frontmatter from the saved markdown
  --html                  Also save rendered HTML
  --meta                  Also save metadata JSON
  --stdout                Print extracted markdown to stdout
  --headed                Run with a visible Chrome/Chromium window
  --engine <engine>       Browser engine (choices: "chrome", "lightpanda", "cloudflare")
  --chrome <path>         Path to Chrome/Chromium executable
  --timeout <ms>          Navigation timeout in ms (default: 30000)
  --delay <ms>            Post-load wait time in ms (default: 1200)
  --user-agent <ua>       Custom user agent string
  --lp-port <port>        Lightpanda CDP port (default: 9222)
  --md-engine <engine>    Markdown extraction engine (choices: "defuddle", "turndown", default: "defuddle")
  --config <path>         Path to webfn config file
  -o, --output-dir <dir>  Output directory for artifacts
  --no-save               Skip writing files to disk
  --json                  Force JSON output
  --wait-until <mode>     Navigation wait mode (choices: "domcontentloaded", "networkidle2", default: "networkidle2")
  -h, --help              display help for command
```

## `search`

```
Usage: webfn search [options] <query>

Search the web with a browser-backed provider

Arguments:
  query                   Search query

Options:
  -n, --results <count>   Max results to return (default: 10)
  --provider <provider>   Search provider (choices: "google", "duckduckgo", default: "google")
  --headed                Run with a visible Chrome/Chromium window
  --engine <engine>       Browser engine (choices: "chrome", "lightpanda", "cloudflare")
  --chrome <path>         Path to Chrome/Chromium executable
  --timeout <ms>          Navigation timeout in ms (default: 30000)
  --delay <ms>            Post-load wait time in ms (default: 1200)
  --user-agent <ua>       Custom user agent string
  --lp-port <port>        Lightpanda CDP port (default: 9222)
  --config <path>         Path to webfn config file
  -o, --output-dir <dir>  Output directory for artifacts
  --no-save               Skip writing files to disk
  --json                  Force JSON output
  -h, --help              display help for command
```

## `collect`

```
Usage: webfn collect [options] <query>

Search, fetch each result, and save collected artifacts

Arguments:
  query                   Search query

Options:
  -n, --results <count>   Results to collect (default: 5)
  --provider <provider>   Search provider (choices: "google", "duckduckgo", default: "google")
  --html                  Also save rendered HTML for each page
  --meta                  Also save metadata JSON for each page
  --headed                Run with a visible Chrome/Chromium window
  --engine <engine>       Browser engine (choices: "chrome", "lightpanda", "cloudflare")
  --chrome <path>         Path to Chrome/Chromium executable
  --timeout <ms>          Navigation timeout in ms (default: 30000)
  --delay <ms>            Post-load wait time in ms (default: 1200)
  --user-agent <ua>       Custom user agent string
  --lp-port <port>        Lightpanda CDP port (default: 9222)
  --md-engine <engine>    Markdown extraction engine (choices: "defuddle", "turndown", default: "defuddle")
  --config <path>         Path to webfn config file
  -o, --output-dir <dir>  Output directory for artifacts
  --no-save               Skip writing files to disk
  --json                  Force JSON output
  --wait-until <mode>     Navigation wait mode (choices: "domcontentloaded", "networkidle2", default: "networkidle2")
  -h, --help              display help for command
```

## `crawl`

```
Usage: webfn crawl [options] <url>

Discover pages via sitemap or internal links

Arguments:
  url                     Root site URL

Options:
  --mode <mode>           Crawl strategy (choices: "auto", "sitemap", "links", default: "auto")
  --depth <count>         Max link-crawl depth (default: 2)
  --max-pages <count>     Max pages to process (default: 25)
  --fetch-pages           Save page artifacts for every crawled page
  --html                  Also save rendered HTML for crawled pages
  --meta                  Also save metadata JSON for crawled pages
  --headed                Run with a visible Chrome/Chromium window
  --engine <engine>       Browser engine (choices: "chrome", "lightpanda", "cloudflare")
  --chrome <path>         Path to Chrome/Chromium executable
  --timeout <ms>          Navigation timeout in ms (default: 30000)
  --delay <ms>            Post-load wait time in ms (default: 1200)
  --user-agent <ua>       Custom user agent string
  --lp-port <port>        Lightpanda CDP port (default: 9222)
  --md-engine <engine>    Markdown extraction engine (choices: "defuddle", "turndown", default: "defuddle")
  --config <path>         Path to webfn config file
  -o, --output-dir <dir>  Output directory for artifacts
  --no-save               Skip writing files to disk
  --json                  Force JSON output
  --wait-until <mode>     Navigation wait mode (choices: "domcontentloaded", "networkidle2", default: "networkidle2")
  -h, --help              display help for command
```

## `screenshot`

```
Usage: webfn screenshot [options] <url>

Take a screenshot of a website

Arguments:
  url                     URL to screenshot

Options:
  --full                  Take a full page screenshot (default: false)
  -o, --output-dir <dir>  Output directory for the screenshot
  --headed                Run with a visible Chrome/Chromium window
  --engine <engine>       Browser engine (choices: "chrome", "lightpanda", "cloudflare")
  --chrome <path>         Path to Chrome/Chromium executable
  --timeout <ms>          Navigation timeout in ms (default: 30000)
  --delay <ms>            Post-load wait time in ms (default: 1200)
  --user-agent <ua>       Custom user agent string
  --lp-port <port>        Lightpanda CDP port (default: 9222)
  --wait-until <mode>     Navigation wait mode (default: "networkidle2")
  -h, --help              display help for command
```
