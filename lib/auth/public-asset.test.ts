import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readPublicImage, resolvePublicAsset } from "./public-asset.ts";

test("public asset reads stay inside street-view and layouts", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-asset-"));
  const root = path.join(dir, "public");
  fs.mkdirSync(path.join(root, "street-view"), { recursive: true });
  fs.mkdirSync(path.join(root, "layouts"), { recursive: true });
  fs.writeFileSync(path.join(root, "street-view", "344-targee-street.jpg"), "jpeg");
  fs.writeFileSync(path.join(root, "layouts", "plan.png"), "png");
  fs.writeFileSync(path.join(dir, "secret.txt"), "nope");

  try {
    assert.equal(resolvePublicAsset("/street-view/344-targee-street.jpg", root)?.endsWith("344-targee-street.jpg"), true);
    assert.equal(resolvePublicAsset("/layouts/plan.png", root)?.endsWith("plan.png"), true);
    assert.equal(resolvePublicAsset("/street-view/../secret.txt", root), null);
    assert.equal(resolvePublicAsset("/units/apt-344-targee-street-unit-1b", root), null);
    assert.equal(resolvePublicAsset("/admin", root), null);
    assert.equal(resolvePublicAsset("//street-view/344-targee-street.jpg", root), null);

    const photo = await readPublicImage("/street-view/344-targee-street.jpg", root);
    assert.equal(photo?.contentType, "image/jpeg");
    assert.equal(photo?.body.toString(), "jpeg");
    const plan = await readPublicImage("/layouts/plan.png", root);
    assert.equal(plan?.contentType, "image/png");
    assert.equal(await readPublicImage("/street-view/missing.jpg", root), null);

    fs.writeFileSync(path.join(root, "street-view", "notes.txt"), "text");
    assert.equal(await readPublicImage("/street-view/notes.txt", root), null);

    const link = path.join(root, "street-view", "escape.jpg");
    fs.symlinkSync(path.join(dir, "secret.txt"), link);
    assert.equal(await readPublicImage("/street-view/escape.jpg", root), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
