import { createHash } from "node:crypto";

export function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function hashText(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

export function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s/-]+/g, "")
    .replace(/[/\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return slug || "item";
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
