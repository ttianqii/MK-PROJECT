// Student id + name with avatar, shown in the dashboard navbar.
// Server- and client-safe.
export default function StudentBanner({
  studentId,
  nameEn,
  photo,
}: {
  studentId: string;
  nameEn: string;
  photo: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-gray-200"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 ring-2 ring-gray-200">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z" />
          </svg>
        </span>
      )}
      {/* Id/name text only where there's room to spare; avatar alone on phones. */}
      <div className="hidden min-w-0 max-w-28 sm:block md:max-w-none">
        <p className="truncate text-sm font-bold leading-tight tracking-wide text-gray-800">
          {studentId}
        </p>
        <p className="hidden truncate text-xs font-medium uppercase text-gray-500 md:block">
          {nameEn}
        </p>
      </div>
    </div>
  );
}
