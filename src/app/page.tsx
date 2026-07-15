import Link from "next/link";
import { getSession } from "@/lib/serverAuth";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gray-100 px-4 py-8">
      <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-md bg-white p-6 text-center shadow-xl sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Study Plan</h1>
        <p className="text-base leading-7 text-gray-500">
          Plan your courses, track your progress, and stay on top of your degree — a self-contained
          demo running on local data.
        </p>
        {session ? (
          <Link
            href="/dashboard"
            className="flex h-12 w-full items-center justify-center rounded-md bg-blue-600 px-5 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Go to your dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-md bg-blue-600 px-5 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Sign in
          </Link>
        )}
      </main>
    </div>
  );
}
