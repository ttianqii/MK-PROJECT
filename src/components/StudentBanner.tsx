// Student id + name with avatar and the red accent bar, shown in the
// dashboard navbar. Server- and client-safe.
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
    <div className="flex min-w-0 items-center gap-2.5 border-l-4 border-rose-700 pl-2.5">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="h-10 w-10 rounded-full border border-gray-200 object-cover"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-400">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z" />
          </svg>
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-bold leading-tight tracking-wide text-gray-800">
          {studentId}
        </p>
        <p className="truncate text-xs font-medium uppercase text-gray-600">{nameEn}</p>
      </div>
    </div>
  );
}
