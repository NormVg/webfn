import type { BrowserLaunchOptions } from "./browser.js";
import { sleep } from "../lib/text.js";

export async function fetchCloudflareContent(url: string, options: BrowserLaunchOptions): Promise<string> {
  const accountId = options.cloudflareAccountId;
  const apiToken = options.cloudflareApiToken;

  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare credentials missing. Set CLOUDFLARE_ACC_ID and CLOUDFLARE_TOKEN in .env or configure them in webfn.config.json."
    );
  }

  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 5000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/content`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          url,
          gotoOptions: { waitUntil: "domcontentloaded" },
        }),
      }
    );

    if (!res.ok) {
      if (res.status === 429 && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      let errorMsg = `Cloudflare Browser Rendering failed: HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        if (errorJson.errors && errorJson.errors.length > 0) {
          errorMsg += ` - ${errorJson.errors[0].message}`;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMsg);
    }

    const json = await res.json();
    if (!json.success || typeof json.result !== "string") {
      throw new Error("Cloudflare returned an invalid response format.");
    }

    return json.result;
  }

  throw new Error("Cloudflare Browser Rendering failed after maximum retries.");
}
