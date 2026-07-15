"use client";

// A real draggable bottom sheet with snap detents. Drag the grab handle to
// resize; on release it snaps to the nearest detent (given in vh), and
// dragging/flicking down past the smallest detent dismisses it. The header is
// fixed (and part of the drag area); children scroll inside.
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function BottomSheet({
  open,
  onClose,
  header,
  children,
  detents = [50, 82],
  initial = 82,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  header?: ReactNode;
  children: ReactNode;
  detents?: number[]; // snap heights in vh, ascending (a "closed" detent at 0 is implied)
  initial?: number; // detent to open at
  ariaLabel?: string;
}) {
  const [vh, setVh] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; vh: number } | null>(null);

  // Snap back to the opening detent each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setVh(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const snaps = [0, ...detents];

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, vh };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = ((e.clientY - drag.current.y) / window.innerHeight) * 100;
    // Dragging up (dy < 0) grows the sheet; down shrinks it.
    setVh(Math.max(0, Math.min(92, drag.current.vh - dy)));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    // Snap to the nearest detent; the "closed" detent (0) dismisses.
    const nearest = snaps.reduce((a, b) => (Math.abs(b - vh) < Math.abs(a - vh) ? b : a));
    if (nearest === 0) onClose();
    else setVh(nearest);
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{ height: `${vh}vh` }}
        className={`absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl ${
          dragging ? "" : "transition-[height,transform] duration-300 ease-out"
        } ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Grab handle + fixed header: the drag area */}
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="shrink-0 cursor-ns-resize touch-none"
        >
          <div className="flex justify-center pb-1 pt-3" role="separator" aria-label="Drag to resize">
            <span className="h-1.5 w-10 rounded-full bg-gray-300" />
          </div>
          {header}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
