'use client';

import { GlobalErrorBoundary } from '@/components/shared/global-error-boundary';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 flex min-h-screen items-center justify-center p-4">
        <GlobalErrorBoundary error={error} reset={reset} routeName="Global Root Route" />
      </body>
    </html>
  );
}
