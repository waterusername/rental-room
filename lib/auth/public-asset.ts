import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

const PUBLIC_IMAGE = /^\/(street-view|layouts)\/([A-Za-z0-9._-]+)$/;

export function resolvePublicAsset(src: string, publicRoot = path.resolve(process.cwd(), "public")): string | null {
  const parsed = parsePublicImage(src);
  if (!parsed) return null;
  const root = path.resolve(publicRoot);
  const file = path.resolve(root, parsed.folder, parsed.name);
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const top = relative.split(path.sep)[0];
  if (top !== parsed.folder) return null;
  return file;
}

export function imageContentType(filePath: string): string | null {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

function parsePublicImage(src: string): { folder: "street-view" | "layouts"; name: string } | null {
  const match = PUBLIC_IMAGE.exec(src);
  if (!match) return null;
  const name = match[2] ?? "";
  if (!name || name === "." || name === "..") return null;
  return { folder: match[1] === "layouts" ? "layouts" : "street-view", name };
}

async function readScoped(dir: string, name: string): Promise<{ body: Buffer; contentType: string } | null> {
  const file = path.join(dir, name);
  let dirReal: string;
  let fileReal: string;
  try {
    dirReal = await realpath(dir);
    fileReal = await realpath(file);
  } catch {
    return null;
  }
  const relative = path.relative(dirReal, fileReal);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(path.sep)) return null;
  const contentType = imageContentType(fileReal);
  if (!contentType) return null;
  return { body: await readFile(fileReal), contentType };
}

export async function readPublicImage(
  src: string,
  publicRoot = path.resolve(process.cwd(), "public"),
): Promise<{ body: Buffer; contentType: string } | null> {
  const parsed = parsePublicImage(src);
  if (!parsed) return null;
  const scopedRoot = path.resolve(publicRoot);
  if (scopedRoot === path.resolve(process.cwd(), "public")) {
    if (parsed.folder === "street-view") {
      return readScoped(path.join(process.cwd(), "public", "street-view"), parsed.name);
    }
    return readScoped(path.join(process.cwd(), "public", "layouts"), parsed.name);
  }
  return readScoped(path.join(scopedRoot, parsed.folder), parsed.name);
}
