import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";

type Props = {
  sessionId: string;
  url?: string;
  picking: boolean;
  onSelectorPicked: (selector: string) => void;
  onPickingCancelled: () => void;
};

type Rect = { x: number; y: number; width: number; height: number };

const SCREENSHOT_INTERVAL_MS = 400;
const MOVE_THROTTLE_MS = 100;

export default function LiveScreenPreview({
  sessionId,
  url,
  picking,
  onSelectorPicked,
  onPickingCancelled,
}: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastMoveRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Rect | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/v1/links/${sessionId}/live-session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.response);
        }
        if (!cancelled) setReady(true);
      })
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
      fetch(`/api/v1/links/${sessionId}/live-session/stop`, { method: "POST" });
    };
  }, [sessionId]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const fetchFrame = async () => {
      try {
        const res = await fetch(
          `/api/v1/links/${sessionId}/live-session/screenshot`
        );
        if (!res.ok || cancelled) return;

        const blob = await res.blob();
        if (cancelled) return;

        const frameUrl = URL.createObjectURL(blob);
        if (imgRef.current) imgRef.current.src = frameUrl;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = frameUrl;
      } catch {}
    };

    fetchFrame();
    const interval = setInterval(fetchFrame, SCREENSHOT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, sessionId]);

  useEffect(() => {
    if (!picking) {
      setOverlay(null);
      return;
    }

    const onDocumentMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        onPickingCancelled();
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown, true);
    return () =>
      document.removeEventListener("mousedown", onDocumentMouseDown, true);
  }, [picking, onPickingCancelled]);

  const relativePosition = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
      displayRect: rect,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const now = Date.now();
    if (now - lastMoveRef.current < MOVE_THROTTLE_MS) return;
    lastMoveRef.current = now;

    const { x, y, displayRect } = relativePosition(e);

    if (picking) {
      fetch(`/api/v1/links/${sessionId}/live-session/hover-rect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      })
        .then((res) => res.json())
        .then((data) => {
          const rect = data.response?.rect;
          const viewport = data.response?.viewport;
          if (!rect || !viewport) return setOverlay(null);

          const scaleX = displayRect.width / viewport.width;
          const scaleY = displayRect.height / viewport.height;
          setOverlay({
            x: rect.x * scaleX,
            y: rect.y * scaleY,
            width: rect.width * scaleX,
            height: rect.height * scaleY,
          });
        })
        .catch(() => {});
      return;
    }

    fetch(`/api/v1/links/${sessionId}/live-session/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "move", x, y }),
    });
  };

  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const { x, y } = relativePosition(e);

    if (picking) {
      fetch(`/api/v1/links/${sessionId}/live-session/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.response?.selector) {
            onSelectorPicked(data.response.selector);
          }
          onPickingCancelled();
        });
      return;
    }

    fetch(`/api/v1/links/${sessionId}/live-session/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "click", x, y }),
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

    fetch(`/api/v1/links/${sessionId}/live-session/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "scroll", x, y, deltaY: e.deltaY }),
    });
  };

  if (error) {
    return (
      <div className="grow flex items-center justify-center bg-base-200 text-neutral text-center p-5">
        {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="grow flex items-center justify-center bg-base-200 text-neutral">
        {t("loading")}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative grow min-h-0">
      <img
        ref={imgRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onWheel={handleWheel}
        className={`w-full h-full object-contain bg-black ${
          picking ? "cursor-crosshair" : "cursor-default"
        }`}
        alt=""
      />
      {overlay && (
        <div
          className="absolute pointer-events-none border-2 border-pink-500 bg-pink-500/25"
          style={{
            left: overlay.x,
            top: overlay.y,
            width: overlay.width,
            height: overlay.height,
          }}
        />
      )}
    </div>
  );
}
