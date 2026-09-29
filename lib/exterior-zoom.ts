export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const STOPS = [1, 1.5, 2, 3, 4] as const;

export type ZoomView = {
  scale: number;
  x: number;
  y: number;
};

export type Box = {
  width: number;
  height: number;
};

export const FIT_ZOOM: ZoomView = { scale: MIN_ZOOM, x: 0, y: 0 };

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Keep a scaled photo inside the stage. Scale 1 is always the fitted, centered photo. */
export function clampZoomView(view: ZoomView, image: Box, stage: Box): ZoomView {
  const scale = clampZoom(view.scale);
  if (scale <= 1) return FIT_ZOOM;
  if (image.width <= 0 || image.height <= 0 || stage.width <= 0 || stage.height <= 0) {
    return { scale, x: 0, y: 0 };
  }
  const maxX = Math.max(0, (image.width * scale - stage.width) / 2);
  const maxY = Math.max(0, (image.height * scale - stage.height) / 2);
  return {
    scale,
    x: clamp(view.x, -maxX, maxX),
    y: clamp(view.y, -maxY, maxY),
  };
}

/**
 * Change scale while keeping the stage point under `client` fixed.
 * `client` is in viewport coordinates. `origin` is the stage box.
 * Translation is in screen pixels and the photo scales around its center.
 */
export function zoomAtPoint(
  view: ZoomView,
  nextScale: number,
  client: { x: number; y: number },
  origin: Box & { left: number; top: number },
): ZoomView {
  const scale = clampZoom(nextScale);
  if (view.scale <= 0 || origin.width <= 0 || origin.height <= 0) {
    return { scale, x: 0, y: 0 };
  }
  const centerX = origin.width / 2 + view.x;
  const centerY = origin.height / 2 + view.y;
  const pointX = client.x - origin.left;
  const pointY = client.y - origin.top;
  const localX = (pointX - centerX) / view.scale;
  const localY = (pointY - centerY) / view.scale;
  return {
    scale,
    x: pointX - localX * scale - origin.width / 2,
    y: pointY - localY * scale - origin.height / 2,
  };
}

export function stepZoom(scale: number, direction: 1 | -1): number {
  if (direction > 0) return STOPS.find((stop) => stop > scale + 0.02) ?? MAX_ZOOM;
  return [...STOPS].reverse().find((stop) => stop < scale - 0.02) ?? MIN_ZOOM;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  const next = Math.min(max, Math.max(min, value));
  return next === 0 ? 0 : next;
}
