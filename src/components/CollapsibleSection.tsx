"use client";

import { useState, type ReactNode } from "react";

// A single collapsible section. At the top level (default) it's a white card
// with a shadow; when `nested` it's a flatter row divided by a top border, so
// it reads as a child of an enclosing card. Open state is either driven by the
// parent (forceOpen, e.g. while searching) or managed locally.
export default function CollapsibleSection({
  id,
  header,
  headerRight,
  defaultOpen = false,
  forceOpen,
  nested = false,
  children,
}: {
  id: string;
  header: ReactNode;
  headerRight?: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  nested?: boolean;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  // While a search is active the parent forces matching sections open. When
  // forceOpen clears (search reset), snap back to defaultOpen so sections don't
  // stay open after the user clears the search box. We adjust state during
  // render (tracking the previous forceOpen) rather than in an effect.
  const [prevForceOpen, setPrevForceOpen] = useState(forceOpen);
  if (prevForceOpen !== forceOpen) {
    setPrevForceOpen(forceOpen);
    if (forceOpen === undefined) setInternalOpen(defaultOpen);
  }
  const open = forceOpen !== undefined ? forceOpen : internalOpen;

  const sectionClass = nested
    ? "border-t border-gray-100 first:border-t-0"
    : "overflow-hidden rounded-3xl bg-white shadow-sm";
  const buttonClass = nested
    ? `flex w-full flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 pl-8 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 sm:px-6 sm:pl-10 ${open ? "border-b border-gray-100" : ""}`
    : `flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 sm:px-6 ${open ? "border-b border-gray-100" : ""}`;

  return (
    <section className={sectionClass}>
      <button
        type="button"
        onClick={() => forceOpen === undefined && setInternalOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className={buttonClass}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
              nested ? "text-gray-400" : open ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          {header}
        </span>
        {headerRight}
      </button>

      {open ? <div id={id}>{children}</div> : null}
    </section>
  );
}
