import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier) && context.parentURL) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
      if (existsSync(base + ext)) return nextResolve(`${specifier}${ext}`, context);
    }
  }
  return nextResolve(specifier, context);
}
