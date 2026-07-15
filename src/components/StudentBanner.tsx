// Student id + name header with avatar and the red accent bar, shared by the
// My Plan and Registration Result screens. Server- and client-safe.
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
    <div className="flex items-center gap-3 border-l-4 border-rose-700 pl-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="h-14 w-14 rounded-full border border-gray-200 object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-gray-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z" />
          </svg>
        </span>
      )}
      <div className="min-w-0">
        <p className="text-lg font-bold tracking-wide text-gray-800">{studentId}</p>
        <p className="truncate text-sm font-medium uppercase text-gray-600">{nameEn}</p>
      </div>
    </div>
  );
}
