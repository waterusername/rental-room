import assert from "node:assert/strict";
import test from "node:test";
import { clampZoomView, FIT_ZOOM, stepZoom, zoomAtPoint } from "./exterior-zoom.ts";

const image = { width: 400, height: 300 };
const stage = { width: 800, height: 600 };

test("fitted zoom stays centered and ignores leftover pan", () => {
  assert.deepEqual(clampZoomView({ scale: 1, x: 40, y: -20 }, image, stage), FIT_ZOOM);
  assert.deepEqual(clampZoomView({ scale: 0.2, x: 10, y: 10 }, image, stage), FIT_ZOOM);
});

test("pan stops at the edge of a zoomed photo", () => {
  const view = clampZoomView({ scale: 2, x: 500, y: -80 }, image, stage);
  assert.equal(view.scale, 2);
  assert.equal(view.x, 0);
  assert.equal(view.y, 0);

  const tall = clampZoomView({ scale: 2, x: 40, y: 900 }, { width: 400, height: 600 }, stage);
  assert.equal(tall.x, 0);
  assert.equal(tall.y, 300);
});

test("zooming toward a point keeps that point still", () => {
  const origin = { ...stage, left: 100, top: 50 };
  const start = { scale: 1, x: 0, y: 0 };
  const client = { x: 180, y: 140 };
  const next = zoomAtPoint(start, 2, client, origin);
  const before = localPoint(start, client, origin);
  const after = localPoint(next, client, origin);
  assert.ok(Math.abs(before.x - after.x) < 0.001);
  assert.ok(Math.abs(before.y - after.y) < 0.001);
  assert.equal(next.scale, 2);
});

test("zoom steps move between fixed stops and cap at the ends", () => {
  assert.equal(stepZoom(1, 1), 1.5);
  assert.equal(stepZoom(1.5, 1), 2);
  assert.equal(stepZoom(4, 1), 4);
  assert.equal(stepZoom(2, -1), 1.5);
  assert.equal(stepZoom(1, -1), 1);
});

function localPoint(
  view: { scale: number; x: number; y: number },
  client: { x: number; y: number },
  origin: { width: number; height: number; left: number; top: number },
) {
  const centerX = origin.width / 2 + view.x;
  const centerY = origin.height / 2 + view.y;
  return {
    x: (client.x - origin.left - centerX) / view.scale,
    y: (client.y - origin.top - centerY) / view.scale,
  };
}
