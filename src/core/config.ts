import { access, readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OUTPUT_DIR = "data";
export const DEFAULT_CONFIG_FILE = "webfn.config.json";

type OutputDirSource = "cli" | "config" | "default" | "env";

export type WebfnConfig = {
  outputDir?: string;
  provider?: "google" | "duckduckgo";
  mdEngine?: "defuddle" | "turndown";
  timeout?: number;
  delay?: number;
  results?: number;
  waitUntil?: "domcontentloaded" | "networkidle2";
  engine?: "chrome" | "lightpanda";
};

const CONFIG_KEYS: Record<keyof WebfnConfig, "string" | "number"> = {
  outputDir: "string",
  provider: "string",
  mdEngine: "string",
  timeout: "number",
  delay: "number",
  results: "number",
  waitUntil: "string",
  engine: "string",
};

export type ResolvedOutputDirectory = {
  path: string;
  raw: string;
  source: OutputDirSource;
  configPath?: string;
};

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertConfigRecord(value: unknown, configPath: string): asserts value is WebfnConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Config file must contain a JSON object: ${configPath}`);
  }

  const record = value as Record<string, unknown>;

  for (const [key, expectedType] of Object.entries(CONFIG_KEYS)) {
    const v = record[key];
    if (v === undefined) continue;

    if (expectedType === "string" && (typeof v !== "string" || v.trim() === "")) {
      throw new Error(`Config "${key}" must be a non-empty string: ${configPath}`);
    }
    if (expectedType === "number" && (typeof v !== "number" || v <= 0)) {
      throw new Error(`Config "${key}" must be a positive number: ${configPath}`);
    }
  }
}

export function isValidConfigKey(key: string): key is keyof WebfnConfig {
  return key in CONFIG_KEYS;
}

export function getConfigKeyType(key: keyof WebfnConfig): "string" | "number" {
  return CONFIG_KEYS[key];
}

export async function loadConfig(configPath?: string) {
  const resolvedPath = path.resolve(configPath ?? DEFAULT_CONFIG_FILE);
  const explicit = Boolean(configPath);

  if (!(await pathExists(resolvedPath))) {
    if (explicit) {
      throw new Error(`Config file not found: ${resolvedPath}`);
    }

    return null;
  }

  const raw = await readFile(resolvedPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  assertConfigRecord(parsed, resolvedPath);

  return {
    config: parsed,
    path: resolvedPath
  };
}

export async function writeConfig(config: WebfnConfig, configPath?: string) {
  const { writeFile } = await import("node:fs/promises");
  const resolvedPath = path.resolve(configPath ?? DEFAULT_CONFIG_FILE);
  await writeFile(resolvedPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return resolvedPath;
}

function resolveDirectory(raw: string, source: OutputDirSource, baseDir: string, configPath?: string): ResolvedOutputDirectory {
  const resolved: ResolvedOutputDirectory = {
    path: path.resolve(baseDir, raw),
    raw,
    source
  };

  if (configPath) {
    resolved.configPath = configPath;
  }

  return resolved;
}

export async function resolveOutputDirectory(options: { configPath?: string; outputDir?: string } = {}) {
  if (options.outputDir) {
    return resolveDirectory(options.outputDir, "cli", process.cwd());
  }

  const envOutputDir = process.env.WEBFN_OUTPUT_DIR?.trim();

  if (envOutputDir) {
    return resolveDirectory(envOutputDir, "env", process.cwd());
  }

  const loaded = await loadConfig(options.configPath);

  if (loaded?.config.outputDir) {
    return resolveDirectory(loaded.config.outputDir, "config", path.dirname(loaded.path), loaded.path);
  }

  return resolveDirectory(DEFAULT_OUTPUT_DIR, "default", process.cwd(), loaded?.path);
}
