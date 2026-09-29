"use client";

import Image from "next/image";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  clampZoomView,
  FIT_ZOOM,
  MAX_ZOOM,
  stepZoom,
  zoomAtPoint,
  type ZoomView,
} from "@/lib/exterior-zoom";

const FRAME = "relative block h-[min(70vh,760px)] min-h-80 w-full bg-panel-2";

export function ExteriorPhoto({
  src,
  alt,
  credit,
  objectPosition,
  direct = false,
}: {
  src: string;
  alt: string;
  credit: string;
  objectPosition?: string;
  direct?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const position = objectPosition ?? "center";
  const close = useCallback(() => setOpen(false), []);

  return (
    <figure className="mt-4 w-full overflow-hidden rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
      <button
        type="button"
        className="relative block w-full cursor-zoom-in text-left"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className={FRAME}>
          {direct ? (
            // Share links bypass the image optimizer. The token is the src.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: position }}
            />
          ) : (
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover"
              style={{ objectPosition: position }}
              sizes="(min-width: 1152px) 1104px, 100vw"
            />
          )}
        </span>
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-[#1b3a31]/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Zoom
        </span>
      </button>
      <figcaption className="border-t border-line px-4 py-2 text-xs text-muted">{credit}</figcaption>
      {open ? createPortal(<ExteriorZoom src={src} alt={alt} onClose={close} />, document.body) : null}
    </figure>
  );
}

function ExteriorZoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const viewRef = useRef<ZoomView>(FIT_ZOOM);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number; x: number; y: number } | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const moved = useRef(false);
  const pointerOnPhoto = useRef(false);
  const [view, setView] = useState<ZoomView>(FIT_ZOOM);
  const titleId = useId();
  const hintId = useId();

  const commit = useCallback((next: ZoomView) => {
    const photo = photoRef.current;
    const stage = stageRef.current;
    const clamped = clampZoomView(
      next,
      { width: photo?.offsetWidth ?? 0, height: photo?.offsetHeight ?? 0 },
      { width: stage?.clientWidth ?? 0, height: stage?.clientHeight ?? 0 },
    );
    const current = viewRef.current;
    if (current.scale === clamped.scale && current.x === clamped.x && current.y === clamped.y) return;
    viewRef.current = clamped;
    setView(clamped);
  }, []);

  const fitPhoto = useCallback(() => {
    const photo = photoRef.current;
    const stage = stageRef.current;
    if (!photo || !stage) return;
    const naturalWidth = photo.naturalWidth;
    const naturalHeight = photo.naturalHeight;
    if (!naturalWidth || !naturalHeight || stage.clientWidth <= 0 || stage.clientHeight <= 0) return;
    const fitted = Math.min(stage.clientWidth / naturalWidth, stage.clientHeight / naturalHeight);
    photo.style.width = `${Math.max(1, Math.floor(naturalWidth * fitted))}px`;
    photo.style.height = `${Math.max(1, Math.floor(naturalHeight * fitted))}px`;
    commit(viewRef.current);
  }, [commit]);

  const zoomFromCenter = useCallback((direction: 1 | -1) => {
    const stage = stageRef.current;
    const current = viewRef.current;
    const scale = stepZoom(current.scale, direction);
    if (!stage) {
      commit(scale <= 1 ? FIT_ZOOM : { ...current, scale });
      return;
    }
    const box = stageBox(stage);
    commit(zoomAtPoint(current, scale, { x: box.left + box.width / 2, y: box.top + box.height / 2 }, box));
  }, [commit]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const photo = photoRef.current;
    const dialog = dialogRef.current;
    if (!stage || !photo) return;
    fitPhoto();
    const observer = new ResizeObserver(() => fitPhoto());
    observer.observe(stage);
    photo.addEventListener("load", fitPhoto);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const strength = Math.max(-0.6, Math.min(0.6, -event.deltaY * 0.0015));
      const next = zoomAtPoint(viewRef.current, viewRef.current.scale * Math.exp(strength), {
        x: event.clientX,
        y: event.clientY,
      }, stageBox(stage));
      commit(next);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomFromCenter(1);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomFromCenter(-1);
      } else if (event.key === "0") {
        event.preventDefault();
        commit(FIT_ZOOM);
      }
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    dialog?.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      photo.removeEventListener("load", fitPhoto);
      stage.removeEventListener("wheel", onWheel);
      dialog?.removeEventListener("keydown", onKey);
    };
  }, [commit, fitPhoto, zoomFromCenter]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    pointerOnPhoto.current =
      event.target instanceof HTMLElement && event.target.dataset.zoom === "photo";
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved.current = false;
    syncGesture();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      const distance = fingerDistance(points[0], points[1]);
      const active = pinch.current ?? {
        distance,
        scale: viewRef.current.scale,
        x: viewRef.current.x,
        y: viewRef.current.y,
      };
      if (!pinch.current) pinch.current = active;
      if (Math.abs(distance - active.distance) > 2) moved.current = true;
      const nextScale = active.distance > 8 ? (active.scale * distance) / active.distance : active.scale;
      const midpoint = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      };
      const stage = stageRef.current;
      if (!stage) return;
      commit(zoomAtPoint({ scale: active.scale, x: active.x, y: active.y }, nextScale, midpoint, stageBox(stage)));
      return;
    }
    const activePan = pan.current;
    if (!activePan || viewRef.current.scale <= 1) return;
    const dx = event.clientX - activePan.x;
    const dy = event.clientY - activePan.y;
    if (Math.hypot(dx, dy) > 4) moved.current = true;
    commit({ scale: viewRef.current.scale, x: activePan.ox + dx, y: activePan.oy + dy });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0 && viewRef.current.scale < 1.05) commit(FIT_ZOOM);
    syncGesture();
  }

  function syncGesture() {
    const points = [...pointers.current.values()];
    pinch.current = null;
    pan.current = null;
    if (points.length >= 2) {
      pinch.current = {
        distance: fingerDistance(points[0], points[1]),
        scale: viewRef.current.scale,
        x: viewRef.current.x,
        y: viewRef.current.y,
      };
      return;
    }
    if (points.length === 1 && viewRef.current.scale > 1) {
      pan.current = { x: points[0].x, y: points[0].y, ox: viewRef.current.x, oy: viewRef.current.y };
    }
  }

  function onStageClick(event: React.MouseEvent<HTMLDivElement>) {
    if (moved.current) {
      moved.current = false;
      return;
    }
    if (pointerOnPhoto.current) {
      const stage = stageRef.current;
      if (!stage) return;
      const current = viewRef.current;
      const scale = current.scale <= 1.05 ? 2 : stepZoom(current.scale, 1);
      commit(zoomAtPoint(current, scale, { x: event.clientX, y: event.clientY }, stageBox(stage)));
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.stage === "pad" || target === event.currentTarget) onClose();
  }

  const zoomed = view.scale > 1.02;

  return (
    <dialog
      ref={dialogRef}
      className="exterior-zoom"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p id={titleId} className="truncate font-serif text-lg font-semibold">
            {alt}
          </p>
          <p id={hintId} className="text-xs text-white/70">
            Click, pinch, or scroll to zoom
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoomButton label="Zoom out" disabled={view.scale <= 1} onClick={() => zoomFromCenter(-1)}>
            −
          </ZoomButton>
          <span className="w-12 text-center text-xs font-semibold tabular-nums" aria-hidden="true">
            {Math.round(view.scale * 100)}%
          </span>
          <ZoomButton label="Zoom in" disabled={view.scale >= MAX_ZOOM} onClick={() => zoomFromCenter(1)}>
            +
          </ZoomButton>
          <ZoomButton label="Close exterior photo" onClick={onClose}>
            Close
          </ZoomButton>
        </div>
      </header>
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onStageClick}
      >
        <div data-stage="pad" className="flex h-full w-full items-center justify-center">
          {/* Zoom transforms the original file. Share URLs are not optimizer paths. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={photoRef}
            src={src}
            alt={alt}
            draggable={false}
            data-zoom="photo"
            className={`max-h-full max-w-full ${zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transformOrigin: "center center",
            }}
          />
        </div>
      </div>
    </dialog>
  );
}

function ZoomButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}

function stageBox(stage: HTMLElement) {
  const rect = stage.getBoundingClientRect();
  return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
}

function fingerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
