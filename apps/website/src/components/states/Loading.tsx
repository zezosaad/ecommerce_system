'use client';

interface LoadingProps {
  message?: string;
}

export function Loading({ message }: LoadingProps) {
  return (
    <div className="flex items-center justify-center p-8" role="status">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 rtl:border-gray-100" />
      {message && <span className="ml-3 rtl:mr-3 text-gray-600">{message}</span>}
    </div>
  );
}
