"use client";

// A real draggable bottom sheet with snap detents that works across mobile
// browsers (incl. iOS Safari). Rather than setPointerCapture — which iOS
// Safari drops when the sheet is a transformed / scrolling container — the
// drag is tracked with window-level pointer listeners that stay subscribed for
// the whole gesture and clean up on pointerup / pointercancel. Drag the handle
// to resize; on release the sheet snaps to the nearest detent (in vh), and
// dragging down past the smallest detent dismisses it.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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
  const [vh, setVhState] = useState(initial);
  const [dragging, setDragging] = useState(false);
  // `present` keeps the sheet in the DOM only while open or animating closed;
  // `visible` drives the slide/fade. When fully closed the component renders
  // nothing at all, so there's no off-screen panel or shadow lingering.
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);
  const vhRef = useRef(vh);
  const startRef = useRef<{ y: number; vh: number } | null>(null);
  // Keep the latest callback / detents in refs so the drag effect can stay
  // subscribed for the whole gesture instead of tearing down on each parent
  // re-render (the parent passes a fresh detents array every render).
  const onCloseRef = useRef(onClose);
  const detentsRef = useRef(detents);
  useEffect(() => {
    onCloseRef.current = onClose;
    detentsRef.current = detents;
  });

  const setVh = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(92, v));
    vhRef.current = clamped;
    setVhState(clamped);
  }, []);

  // Mount + slide in on open; slide out then fully unmount on close.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      setPresent(true);
      setVh(initial);
      const r = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setTimeout(() => setPresent(false), 320);
    return () => clearTimeout(t);
  }, [open, initial, setVh]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // While dragging, track the pointer on the window and snap on release.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const dy = ((e.clientY - s.y) / window.innerHeight) * 100;
      setVh(s.vh - dy); // dragging up (dy < 0) grows the sheet
    };
    const end = () => {
      startRef.current = null;
      setDragging(false);
      const nz = detentsRef.current;
      const cur = vhRef.current;
      const smallest = Math.min(...nz);
      // Dragged clearly below the smallest detent → close cleanly.
      if (cur < smallest - 8) {
        onCloseRef.current();
        return;
      }
      const nearest = nz.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a));
      setVh(nearest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, setVh]);

  const onHandleDown = (e: React.PointerEvent) => {
    startRef.current = { y: e.clientY, vh: vhRef.current };
    setDragging(true);
  };

  // Fully closed: render nothing so no off-screen panel/shadow lingers.
  if (!present) return null;

  return (
    <div className={`fixed inset-0 z-50 ${visible ? "" : "pointer-events-none"}`} aria-hidden={!visible}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{ height: `${vh}vh` }}
        className={`absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl ${
          dragging ? "" : "transition-[height,transform] duration-300 ease-out"
        } ${visible ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Drag handle: a generous, scroll-proof touch target */}
        <div
          onPointerDown={onHandleDown}
          role="separator"
          aria-label="Drag to resize"
          style={{ touchAction: "none" }}
          className="flex shrink-0 cursor-ns-resize select-none justify-center pb-2 pt-3.5"
        >
          <span className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>
        {header ? <div className="shrink-0">{header}</div> : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
