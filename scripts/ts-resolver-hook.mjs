import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    if (path.extname(base) && existsSync(base)) {
      return nextResolve(pathToFileURL(base).href, context);
    }
    for (const ext of [".ts", ".tsx", ".mjs", ".js", ".json"]) {
      if (existsSync(base + ext)) return nextResolve(pathToFileURL(`${base}${ext}`).href, context);
    }
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier) && context.parentURL) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
      if (existsSync(base + ext)) return nextResolve(`${specifier}${ext}`, context);
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".json")) {
    return {
      format: "json",
      shortCircuit: true,
      source: readFileSync(fileURLToPath(url), "utf8"),
    };
  }
  return nextLoad(url, context);
}
