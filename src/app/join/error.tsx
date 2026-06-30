'use client';

import { GlobalErrorBoundary } from '@/components/shared/global-error-boundary';

export default function JoinError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GlobalErrorBoundary error={error} reset={reset} routeName="Partner Join Route" />;
}
