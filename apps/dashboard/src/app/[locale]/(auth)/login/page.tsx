'use client';

import { useSearchParams } from 'next/navigation';

export default function LoginPage(): React.JSX.Element {
  const params = useSearchParams();
  const returnTo = params.get('return') ?? '/';

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm border border-gray-200 rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-2">Login</h1>
        <p className="text-sm text-gray-600 mb-4">Please authenticate to continue.</p>
        <a className="inline-block px-4 py-2 rounded bg-blue-600 text-white" href={returnTo}>
          Continue
        </a>
      </div>
    </main>
  );
}
