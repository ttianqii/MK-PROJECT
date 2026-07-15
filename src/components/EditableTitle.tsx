"use client";

import { useState } from "react";

// Click-to-edit schedule name: a heading that swaps to a text input. Shared
// by the builder (naming a schedule before it's saved) and My Plan (renaming
// a saved one). Editing can be driven by the built-in pencil, or externally
// (e.g. a dropdown menu) via `editing` + `onEditingChange` and `hideTrigger`.
export default function EditableTitle({
  value,
  placeholder,
  onSave,
  headingClassName = "text-xl font-bold uppercase tracking-wide text-gray-800",
  editing: controlledEditing,
  onEditingChange,
  hideTrigger = false,
}: {
  value: string;
  placeholder: string;
  onSave: (next: string) => void | Promise<void>;
  headingClassName?: string;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = controlledEditing ?? internalEditing;
  const setEditing = onEditingChange ?? setInternalEditing;
  const label = value || placeholder;

  const [draft, setDraft] = useState(label);
  // Reset the draft to the current value each time editing opens, whether
  // that's from the built-in pencil or an external trigger (adjusting state
  // during render, per React's guidance, instead of an effect).
  const [wasEditing, setWasEditing] = useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) setDraft(label);
  }

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={100}
          aria-label="Schedule name"
          className={`w-40 rounded-md border border-gray-300 px-2 py-0.5 focus:border-blue-500 focus:outline-none ${headingClassName}`}
        />
      ) : (
        <h2 className={`truncate ${headingClassName}`}>{label}</h2>
      )}
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Rename ${label}`}
          className="shrink-0 text-gray-400 hover:text-gray-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </button>
      )}
    </div>
  );
}
