"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    // credentials + a hard navigation, for the same reason as the login
    // form: some mobile browsers won't reliably apply a Set-Cookie response
    // from fetch() without explicit credentials, and a full page load
    // guarantees the cleared session is respected immediately.
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      aria-label="Sign out"
      title="Sign out"
      className="shrink-0 whitespace-nowrap rounded-full bg-gray-900 p-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 sm:px-3.5 sm:py-1.5"
    >
      {/* Icon only on phones; label appears once there's room. */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:hidden" aria-hidden="true">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </svg>
      <span className="hidden sm:inline">{isLoading ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}
