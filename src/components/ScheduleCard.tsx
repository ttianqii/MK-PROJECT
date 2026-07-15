import type { ReactNode } from "react";

// The one white card shell used everywhere a schedule/table is shown — My
// Plan, the builder, and Registration Result — so all three render as the
// same surface instead of three hand-rolled copies.
export default function ScheduleCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-3 shadow-sm sm:p-5 ${className}`}>
      {children}
    </section>
  );
}
