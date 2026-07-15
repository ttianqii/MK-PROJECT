"use client";

import { useEffect, useState } from "react";
import PopUpAlert from "@/components/PopUpAlert";

const FORM_ERROR_MESSAGES: Record<string, string> = {
  missing: "Username and password are required.",
  invalid: "Invalid username or password.",
  failed: "Login failed. Please try again.",
};

// Only follow same-origin paths ("/dashboard", not "//evil.com" or full URLs).
function safeFrom(from: string | null) {
  return from && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
}

/*
 * Search params are read from window.location inside the effect and the
 * submit handler — never during render. Rendering them (useSearchParams)
 * would suspend the page at build time and strip the whole form from the
 * production HTML, leaving no-JS/slow-JS phones a blank page with nothing
 * to submit.
 */
type LoginMode = "demo" | "bu";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("demo");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Surfaces the ?error= the API redirects to when a submission reaches it
  // as a plain HTML form post (JS didn't intercept the submit in time).
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) PopUpAlert("warning", FORM_ERROR_MESSAGES[error] || "Login failed.", "warning");
  }, []);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        // Some mobile browsers (notably iOS Safari) won't reliably persist a
        // Set-Cookie response header from fetch() unless credentials are
        // explicitly requested — without this the session cookie can be
        // silently dropped, so the redirect below just bounces back to login.
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, mode }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const from = safeFrom(new URLSearchParams(window.location.search).get("from"));
        // A hard navigation (not router.push) guarantees the freshly-set
        // cookie is sent with the very next request, instead of relying on
        // the client router to have picked it up from this fetch response.
        window.location.href = data.redirectTo || from;
      } else {
        const data = await response.json().catch(() => ({}));
        PopUpAlert("warning", data.message || "Login failed.", "warning");
      }
    } catch {
      PopUpAlert("error", "Login failed. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
      <div className="max-w-md w-full bg-white p-6 rounded-md shadow-xl sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900">Sign in</h2>
        <p className="mt-1 text-sm text-gray-500">
          {mode === "bu"
            ? "Sign in with your real BU account to load your live study plan."
            : "Use your student account to access your study plan."}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode("demo")}
            className={`rounded-md py-1.5 transition-colors ${
              mode === "demo" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Demo account
          </button>
          <button
            type="button"
            onClick={() => setMode("bu")}
            className={`rounded-md py-1.5 transition-colors ${
              mode === "bu" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            BU account
          </button>
        </div>

        {/*
          method/action make this a real, working form even if JavaScript
          never hydrates on the client (the onSubmit handler below normally
          intercepts it first — see the route handler for how the API
          supports both this native form-post path and the JS fetch path).
        */}
        <form onSubmit={handleSubmit} method="post" action="/api/auth/login" className="mt-4">
          <input type="hidden" name="mode" value={mode} />

          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={mode === "bu" ? "e.g. nattapong.tree" : "e.g. demo.student"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <label htmlFor="password" className="block pt-4 text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-md bg-blue-600 p-2.5 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {mode === "demo" ? (
          <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-center text-xs text-blue-700">
            Demo account: <span className="font-mono font-semibold">demo.student</span> /{" "}
            <span className="font-mono font-semibold">demo1234</span>
          </p>
        ) : (
          <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-center text-xs text-blue-700">
            Uses your real MyBU credentials to fetch your live checklist from studentchecklist.bu.ac.th.
            Your password is never stored.
          </p>
        )}
      </div>
    </div>
  );
}
