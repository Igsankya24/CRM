'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { logException } from '@/lib/logger';
import { usePathname } from 'next/navigation';

interface GlobalErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  routeName?: string;
}

export function GlobalErrorBoundary({ error, reset, routeName }: GlobalErrorBoundaryProps) {
  const pathname = usePathname();
  const [showDetails, setShowDetails] = useState(false);
  const activeRoute = routeName || pathname || 'Unknown Route';

  useEffect(() => {
    // Log exception to DB
    logException({
      route: activeRoute,
      errorMsg: error?.message || 'React render crash',
      stack: error?.stack
    });
  }, [error, activeRoute]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center bg-slate-950 rounded-xl border border-slate-800 my-8 max-w-2xl mx-auto w-full select-none">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-md">
        We encountered an error while trying to load the page content on <span className="font-mono text-slate-300">{activeRoute}</span>. Please try again.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <Home className="h-4 w-4" />
          Back to Dashboard
        </a>
      </div>

      <div className="w-full text-left">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-350 transition-colors mx-auto"
        >
          {showDetails ? (
            <>
              Hide Technical Details
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show Technical Details
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>

        {showDetails && (
          <div className="mt-4 p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400 overflow-x-auto max-h-60 w-full">
            <div className="font-bold text-red-400 mb-1">Error: {error?.message}</div>
            {error?.stack && <pre className="whitespace-pre-wrap leading-relaxed">{error.stack}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}
