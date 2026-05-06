'use client';

interface ForbiddenProps {
  title?: string;
  message?: string;
}

export function Forbidden({ title, message }: ForbiddenProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center" role="alert">
      <svg
        className="w-12 h-12 text-amber-500 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
      {title && <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>}
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}
