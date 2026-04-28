import { DEFAULT_USER_AGENT } from "./browser.js";

export async function fetchText(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs: number;
  }
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        ...options.headers
      },
      redirect: "follow",
      signal: controller.signal
    });

    return {
      finalUrl: response.url,
      status: response.status,
      text: await response.text()
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchResponseInfo(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs: number;
  }
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        ...options.headers
      },
      redirect: "follow",
      signal: controller.signal
    });

    await response.body?.cancel();

    return {
      finalUrl: response.url,
      status: response.status
    };
  } finally {
    clearTimeout(timeout);
  }
}
